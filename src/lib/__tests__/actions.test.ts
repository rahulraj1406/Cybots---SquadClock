import { beforeEach, describe, expect, it, vi } from "vitest";

// createSquad must redirect using the invite code it generated locally,
// never one read back from the database. Reading it back would go
// through the "squads" SELECT RLS policy, which only allows members to
// read a squad — and the creator isn't a member yet at this point (that
// happens in the /join step right after redirect). Regression test for
// the bug where .insert().select().single() came back empty under RLS
// and surfaced to users as a generic React error #441.

const insertMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));
const getUserMock = vi.fn();
const signInAnonymouslyMock = vi.fn();
const supabaseMock = {
  from: fromMock,
  auth: { getUser: getUserMock, signInAnonymously: signInAnonymouslyMock },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(supabaseMock)),
}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createSquad, createSlot, deleteSlot, joinSquad } = await import("../actions");

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const initialState = { error: null };

beforeEach(() => {
  insertMock.mockReset();
  fromMock.mockClear();
  redirectMock.mockClear();
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
  signInAnonymouslyMock.mockReset();
});

describe("createSquad", () => {
  it("redirects using the locally generated invite code, not a DB round-trip", async () => {
    insertMock.mockResolvedValue({ data: null, error: null });

    await expect(createSquad(initialState, formData({ name: "Brawl Stars crew" }))).rejects.toThrow(
      /^REDIRECT:/,
    );

    expect(fromMock).toHaveBeenCalledWith("squads");
    const insertedRow = insertMock.mock.calls[0][0];
    expect(insertedRow.name).toBe("Brawl Stars crew");
    expect(typeof insertedRow.invite_code).toBe("string");

    const redirectUrl = redirectMock.mock.calls[0][0] as string;
    expect(redirectUrl).toBe(`/s/${insertedRow.invite_code}/join`);

    // The key regression check: insert() must not be chained with
    // .select()/.single() — mockResolvedValue on insertMock is only
    // valid because nothing is called on its return value.
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("returns the error as form state when the insert fails, without redirecting", async () => {
    insertMock.mockResolvedValue({
      data: null,
      error: { message: "duplicate key value violates unique constraint" },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const state = await createSquad(initialState, formData({ name: "Brawl Stars crew" }));
    expect(state.error).toMatch(/duplicate key/);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("rejects an empty squad name before touching the database", async () => {
    const state = await createSquad(initialState, formData({ name: "  " }));
    expect(state.error).toMatch(/Give your squad a name/);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("signs a brand-new device in anonymously before inserting", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    signInAnonymouslyMock.mockResolvedValue({ data: { user: { id: "anon" } }, error: null });
    insertMock.mockResolvedValue({ data: null, error: null });

    await expect(
      createSquad(initialState, formData({ name: "Brawl Stars crew" })),
    ).rejects.toThrow(/^REDIRECT:/);

    expect(signInAnonymouslyMock).toHaveBeenCalledTimes(1);
    expect(signInAnonymouslyMock.mock.invocationCallOrder[0]).toBeLessThan(
      insertMock.mock.invocationCallOrder[0],
    );
  });

  // Regression for the production bug: with anonymous sign-ins disabled
  // the insert ran with no session, RLS rejected it, and the thrown error
  // reached users only as "Minified React error #441".
  it("explains the Supabase setting when anonymous sign-ins are disabled", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    signInAnonymouslyMock.mockResolvedValue({
      data: { user: null },
      error: { code: "anonymous_provider_disabled", message: "Anonymous sign-ins are disabled" },
    });

    const state = await createSquad(initialState, formData({ name: "Brawl Stars crew" }));

    expect(state.error).toMatch(/Anonymous sign-ins are turned off/);
    expect(insertMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("joinSquad", () => {
  const updateEqUserMock = vi.fn();
  const updateMock = vi.fn(() => ({ eq: () => ({ eq: updateEqUserMock }) }));
  const validJoin = {
    squadId: "8a6e0804-2bd0-4672-b79d-d97027f9071a",
    inviteCode: "abcd2345",
    displayName: "Arjun",
    timezone: "Asia/Kolkata",
  };

  beforeEach(() => {
    insertMock.mockResolvedValue({ error: null });
    updateMock.mockClear();
    updateEqUserMock.mockReset().mockResolvedValue({ error: null });
    fromMock.mockImplementation(() => ({ insert: insertMock, update: updateMock }) as never);
  });

  it("adds the device as a member and redirects to the board", async () => {
    await expect(joinSquad(initialState, formData(validJoin))).rejects.toThrow(
      "REDIRECT:/s/abcd2345",
    );
    expect(fromMock).toHaveBeenCalledWith("members");
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      squad_id: validJoin.squadId,
      user_id: "u1",
      display_name: "Arjun",
      timezone: "Asia/Kolkata",
    });
  });

  it("signs in a brand-new device anonymously instead of failing", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    signInAnonymouslyMock.mockResolvedValue({ data: { user: { id: "anon" } }, error: null });

    await expect(joinSquad(initialState, formData(validJoin))).rejects.toThrow(/^REDIRECT:/);
    expect(insertMock.mock.calls[0][0].user_id).toBe("anon");
  });

  it("rejects a fixed-offset time zone before touching the database", async () => {
    const state = await joinSquad(initialState, formData({ ...validJoin, timezone: "+05:30" }));
    expect(state.error).toMatch(/valid time zone/);
    expect(insertMock).not.toHaveBeenCalled();
  });

  // Regression: upsert (INSERT ... ON CONFLICT DO UPDATE) is checked
  // against the members SELECT policy too, which a not-yet-member fails.
  it("never uses upsert, which RLS rejects for a not-yet-member", async () => {
    await expect(joinSquad(initialState, formData(validJoin))).rejects.toThrow(/^REDIRECT:/);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("updates name and time zone when the device is already a member", async () => {
    insertMock.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });

    await expect(joinSquad(initialState, formData(validJoin))).rejects.toThrow(/^REDIRECT:/);
    expect(updateMock).toHaveBeenCalledWith({ display_name: "Arjun", timezone: "Asia/Kolkata" });
  });

  it("returns the database error as form state", async () => {
    insertMock.mockResolvedValue({ error: { message: "permission denied" } });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const state = await joinSquad(initialState, formData(validJoin));
    expect(state.error).toMatch(/permission denied/);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("createSlot", () => {
  const base = {
    squadId: "8a6e0804-2bd0-4672-b79d-d97027f9071a",
    memberId: "5f1c7a44-0c5d-4b8e-9f43-2f7f0b0a8c11",
    inviteCode: "abcd2345",
    durationHours: "2",
  };

  beforeEach(() => {
    insertMock.mockResolvedValue({ error: null });
    fromMock.mockImplementation(() => ({ insert: insertMock }) as never);
  });

  it("saves 'free now for 2h' as UTC bounds two hours apart", async () => {
    const state = await createSlot(
      initialState,
      formData({ ...base, mode: "relative", startInHours: "0" }),
    );

    expect(state.error).toBeNull();
    const row = insertMock.mock.calls[0][0];
    expect(Date.parse(row.ends_at) - Date.parse(row.starts_at)).toBe(2 * 3600_000);
    expect(row.note).toBeNull();
  });

  it("refuses a slot that has already ended instead of saving an invisible row", async () => {
    const state = await createSlot(
      initialState,
      formData({
        ...base,
        mode: "absolute",
        dateISO: "2020-01-01",
        timeHHmm: "08:00",
        timezone: "Europe/Dublin",
      }),
    );

    expect(state.error).toMatch(/already passed/);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("refuses a date that doesn't exist", async () => {
    const state = await createSlot(
      initialState,
      formData({
        ...base,
        mode: "absolute",
        dateISO: "2099-02-30",
        timeHHmm: "08:00",
        timezone: "Europe/Dublin",
      }),
    );

    expect(state.error).toMatch(/doesn't exist/);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("explains an RLS rejection in plain words", async () => {
    insertMock.mockResolvedValue({ error: { code: "42501", message: "new row violates row-level security policy" } });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const state = await createSlot(
      initialState,
      formData({ ...base, mode: "relative", startInHours: "1" }),
    );

    expect(state.error).toMatch(/rejoin/);
  });
});

describe("deleteSlot", () => {
  it("returns an error instead of throwing when the delete fails", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    fromMock.mockImplementation(() => ({ delete: () => ({ eq: eqMock }) }) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const state = await deleteSlot(
      initialState,
      formData({ slotId: "8a6e0804-2bd0-4672-b79d-d97027f9071a", inviteCode: "abcd2345" }),
    );

    expect(state.error).toMatch(/boom/);
  });
});
