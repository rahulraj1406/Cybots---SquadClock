/**
 * Row Level Security, auth and Realtime behaviour, checked against a real
 * Supabase stack rather than mocks. Every bug that took the app down in
 * production lived in exactly this layer, where unit tests can't see it:
 * a missing session under RLS, an infinitely recursive policy, an upsert
 * that RLS rejects, and realtime events silently filtered out.
 *
 * Run with a local stack:
 *   npx supabase start
 *   npm run test:integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!anonKey) {
  throw new Error(
    "SUPABASE_ANON_KEY is not set. Start a local stack with `npx supabase start`, " +
      "then run `npm run test:integration` (it reads the key from `supabase status`).",
  );
}

type Device = { client: SupabaseClient; userId: string };

async function newDevice(): Promise<Device> {
  const client = createClient(url, anonKey!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw new Error(`anonymous sign-in failed: ${error.message}`);
  return { client, userId: data.user!.id };
}

const code = () => `it${Math.random().toString(36).slice(2, 10)}`;
const inAnHour = () => ({
  starts_at: new Date().toISOString(),
  ends_at: new Date(Date.now() + 3600_000).toISOString(),
});

async function waitFor(check: () => boolean, ms = 8000): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return check();
}

/**
 * Resolves once Realtime reports that the channel's postgres_changes
 * listeners are attached. That happens a moment after SUBSCRIBED, and
 * longer on a cold stack, so a fixed sleep made these tests flaky.
 */
function postgresChangesReady(channel: RealtimeChannel): Promise<boolean> {
  let ready = false;
  channel.on("system", {}, (payload: { extension?: string; status?: string }) => {
    if (payload.extension === "postgres_changes" && payload.status === "ok") ready = true;
  });
  return new Promise((resolve) => {
    channel.subscribe();
    void waitFor(() => ready, 15_000).then(resolve);
  });
}

let owner: Device;
let friend: Device;
let stranger: Device;
let squadId: string;
let inviteCode: string;
let ownerMemberId: string;
let friendMemberId: string;

beforeAll(async () => {
  [owner, friend, stranger] = await Promise.all([newDevice(), newDevice(), newDevice()]);
});

afterAll(async () => {
  await Promise.all([owner, friend, stranger].map((d) => d?.client.removeAllChannels()));
});

describe("auth", () => {
  it("refuses to create a squad without a session", async () => {
    const noSession = createClient(url, anonKey!, { auth: { persistSession: false } });
    const { error } = await noSession.from("squads").insert({ name: "x", invite_code: code() });
    expect(error?.code).toBe("42501"); // the production "#441" failure
  });
});

describe("squads", () => {
  it("lets a signed-in device create a squad (insert without read-back)", async () => {
    inviteCode = code();
    const { error } = await owner.client.from("squads").insert({ name: "IT crew", invite_code: inviteCode });
    expect(error).toBeNull();
  });

  it("hides the squad row from its creator until they join", async () => {
    // Why createSquad must not chain .select().single() after insert.
    const { data } = await owner.client.from("squads").select("id").eq("invite_code", inviteCode);
    expect(data).toEqual([]);
  });

  it("resolves an invite code to id + name for anyone", async () => {
    const { data, error } = await stranger.client
      .rpc("get_squad_by_invite_code", { code: inviteCode })
      .single<{ id: string; name: string }>();
    expect(error).toBeNull();
    expect(data?.name).toBe("IT crew");
    squadId = data!.id;
  });
});

describe("members", () => {
  it("rejects upsert for a device that isn't a member yet", async () => {
    // INSERT ... ON CONFLICT DO UPDATE is also checked against the SELECT
    // policy, which a not-yet-member fails. Why joinSquad uses insert.
    const { error } = await owner.client
      .from("members")
      .upsert(
        { squad_id: squadId, user_id: owner.userId, display_name: "Owner", timezone: "Europe/Dublin" },
        { onConflict: "squad_id,user_id" },
      );
    expect(error?.code).toBe("42501");
  });

  it("lets devices join with a plain insert", async () => {
    for (const [device, name, tz] of [
      [owner, "Owner", "Europe/Dublin"],
      [friend, "Friend", "Asia/Kolkata"],
    ] as const) {
      const { error } = await device.client
        .from("members")
        .insert({ squad_id: squadId, user_id: device.userId, display_name: name, timezone: tz });
      expect(error).toBeNull();
    }
  });

  it("refuses to add someone else as a member", async () => {
    const { error } = await stranger.client
      .from("members")
      .insert({ squad_id: squadId, user_id: owner.userId, display_name: "Fake", timezone: "UTC" });
    expect(error?.code).toBe("42501");
  });

  it("shows members the whole roster without infinite recursion", async () => {
    const { data, error } = await friend.client
      .from("members")
      .select("id, user_id, display_name")
      .eq("squad_id", squadId)
      .order("created_at");
    expect(error).toBeNull(); // 42P17 here = the recursive policy is back
    expect(data!.map((m) => m.display_name)).toEqual(["Owner", "Friend"]);
    ownerMemberId = data!.find((m) => m.user_id === owner.userId)!.id;
    friendMemberId = data!.find((m) => m.user_id === friend.userId)!.id;
  });

  it("hides the roster and squad from a non-member", async () => {
    const [{ data: members }, { data: squads }] = await Promise.all([
      stranger.client.from("members").select("id").eq("squad_id", squadId),
      stranger.client.from("squads").select("id").eq("id", squadId),
    ]);
    expect(members).toEqual([]);
    expect(squads).toEqual([]);
  });

  it("lets a member update only their own row", async () => {
    const own = await friend.client
      .from("members")
      .update({ display_name: "Friend 2" })
      .eq("id", friendMemberId)
      .select("id");
    expect(own.data).toHaveLength(1);

    const other = await friend.client
      .from("members")
      .update({ display_name: "Hijacked" })
      .eq("id", ownerMemberId)
      .select("id");
    expect(other.data).toEqual([]);
  });
});

describe("slots", () => {
  let ownerSlotId: string;

  it("lets a member post a slot as themselves", async () => {
    const { data, error } = await owner.client
      .from("slots")
      .insert({ squad_id: squadId, member_id: ownerMemberId, ...inAnHour() })
      .select("id")
      .single();
    expect(error).toBeNull();
    ownerSlotId = data!.id;
  });

  it("refuses a slot posted as another member", async () => {
    const { error } = await friend.client
      .from("slots")
      .insert({ squad_id: squadId, member_id: ownerMemberId, ...inAnHour() });
    expect(error?.code).toBe("42501");
  });

  it("refuses a slot from a non-member", async () => {
    const { error } = await stranger.client
      .from("slots")
      .insert({ squad_id: squadId, member_id: ownerMemberId, ...inAnHour() });
    expect(error?.code).toBe("42501");
  });

  it("shows slots to members, with the owner joined in, and not to strangers", async () => {
    const { data } = await friend.client
      .from("slots")
      .select("id, member:members(display_name, timezone)")
      .eq("squad_id", squadId);
    expect(data).toEqual([
      { id: ownerSlotId, member: { display_name: "Owner", timezone: "Europe/Dublin" } },
    ]);

    const { data: hidden } = await stranger.client.from("slots").select("id").eq("squad_id", squadId);
    expect(hidden).toEqual([]);
  });

  it("only lets the owner delete a slot", async () => {
    const byFriend = await friend.client.from("slots").delete().eq("id", ownerSlotId).select("id");
    expect(byFriend.data).toEqual([]);

    const byOwner = await owner.client.from("slots").delete().eq("id", ownerSlotId).select("id");
    expect(byOwner.data).toHaveLength(1);
  });
});

describe("realtime", () => {
  it("delivers a squad's slot inserts and deletes to an authenticated member", async () => {
    const events: { type: string; id?: string }[] = [];
    const { data: session } = await friend.client.auth.getSession();
    friend.client.realtime.setAuth(session.session!.access_token);

    const channel = friend.client
      .channel(`it-${squadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "slots", filter: `squad_id=eq.${squadId}` },
        (p) => events.push({ type: "INSERT", id: (p.new as { id: string }).id }),
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "slots" }, (p) =>
        events.push({ type: "DELETE", id: (p.old as { id?: string }).id }),
      );
    expect(await postgresChangesReady(channel)).toBe(true);

    const { data } = await owner.client
      .from("slots")
      .insert({ squad_id: squadId, member_id: ownerMemberId, ...inAnHour() })
      .select("id")
      .single();
    const slotId = data!.id;
    expect(await waitFor(() => events.some((e) => e.type === "INSERT" && e.id === slotId))).toBe(true);

    await owner.client.from("slots").delete().eq("id", slotId);
    expect(await waitFor(() => events.some((e) => e.type === "DELETE" && e.id === slotId))).toBe(true);
  });

  it("filters squad slot events out for a non-member", async () => {
    const received: string[] = [];
    const { data: session } = await stranger.client.auth.getSession();
    stranger.client.realtime.setAuth(session.session!.access_token);

    const channel = stranger.client.channel(`it-stranger-${squadId}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "slots", filter: `squad_id=eq.${squadId}` },
      (p) => received.push((p.new as { id: string }).id),
    );
    expect(await postgresChangesReady(channel)).toBe(true);

    await owner.client.from("slots").insert({ squad_id: squadId, member_id: ownerMemberId, ...inAnHour() });
    await new Promise((r) => setTimeout(r, 2000));
    expect(received).toEqual([]);
  });
});
