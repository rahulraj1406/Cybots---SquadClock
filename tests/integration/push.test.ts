/**
 * Push delivery, end to end on the server side: real Supabase data, real
 * web-push encryption, and a local HTTPS server standing in for the
 * browser's push service (web-push only speaks HTTPS; the server uses a
 * throwaway self-signed certificate made with openssl). The test holds the subscription's private key,
 * so it decrypts exactly what a phone would receive and checks the text.
 */
import { execSync } from "node:child_process";
import { createECDH, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:https";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
// @ts-expect-error: http_ece ships no types; used only to decrypt here.
import ece from "http_ece";

vi.mock("server-only", () => ({}));

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Received = { status: number; body: unknown };
const received: Received[] = [];
let server: Server;
let pushBase: string;
let respondWith = 201;

/** A fake browser subscription: a key pair plus an auth secret. */
function fakeBrowserSubscription(path: string) {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = randomBytes(16);
  return {
    ecdh,
    auth,
    row: {
      endpoint: `${pushBase}/${path}`,
      p256dh: ecdh.getPublicKey().toString("base64url"),
      auth: auth.toString("base64url"),
    },
  };
}

const devices = new Map<string, ReturnType<typeof fakeBrowserSubscription>>();

beforeAll(async () => {
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (see npm run test:integration)");

  const dir = mkdtempSync(path.join(tmpdir(), "push-test-"));
  execSync(
    `openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 1 ` +
      `-subj /CN=127.0.0.1 -keyout ${dir}/key.pem -out ${dir}/cert.pem`,
    { stdio: "ignore" },
  );
  // Trust that throwaway certificate, in this test process only.
  vi.stubEnv("NODE_TLS_REJECT_UNAUTHORIZED", "0");

  server = createServer(
    { key: readFileSync(`${dir}/key.pem`), cert: readFileSync(`${dir}/cert.pem`) },
    (req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const device = devices.get(req.url!.slice(1));
        const body = device
          ? JSON.parse(
              ece
                .decrypt(Buffer.concat(chunks), {
                  version: "aes128gcm",
                  privateKey: device.ecdh,
                  authSecret: device.auth.toString("base64url"),
                })
                .toString("utf8"),
            )
          : null;
        received.push({ status: respondWith, body: { path: req.url, payload: body } });
        res.writeHead(respondWith).end();
      });
    },
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  pushBase = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const vapid = webpush.generateVAPIDKeys();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey);
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", vapid.publicKey);
  vi.stubEnv("VAPID_PRIVATE_KEY", vapid.privateKey);
  vi.stubEnv("VAPID_SUBJECT", "mailto:test@example.com");
});

afterAll(() => {
  vi.unstubAllEnvs();
  server?.close();
});

async function signedIn() {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data } = await client.auth.signInAnonymously();
  return { client, userId: data.user!.id };
}

describe("notifyAboutNewSlot", () => {
  it("delivers each friend a decryptable message in their own time zone", async () => {
    const { notifyAboutNewSlot } = await import("@/lib/push/send");
    const [rahul, arjun, maya] = await Promise.all([signedIn(), signedIn(), signedIn()]);

    const code = `push${Math.random().toString(36).slice(2, 8)}`;
    await rahul.client.from("squads").insert({ name: "Push crew", invite_code: code });
    const { data: squad } = await rahul.client
      .rpc("get_squad_by_invite_code", { code })
      .single<{ id: string }>();

    const memberIds: Record<string, string> = {};
    for (const [who, name, tz] of [
      [rahul, "Rahul", "Europe/Dublin"],
      [arjun, "Arjun", "Asia/Kolkata"],
      [maya, "Maya", "America/Toronto"],
    ] as const) {
      const id = crypto.randomUUID();
      await who.client
        .from("members")
        .insert({ id, squad_id: squad!.id, user_id: who.userId, display_name: name, timezone: tz });
      memberIds[name] = id;
    }

    // Arjun and Maya each subscribe a device through RLS, as the app does.
    for (const name of ["Arjun", "Maya"] as const) {
      const device = fakeBrowserSubscription(name);
      devices.set(name, device);
      const who = name === "Arjun" ? arjun : maya;
      const { error } = await who.client
        .from("push_subscriptions")
        .insert({ member_id: memberIds[name], ...device.row });
      expect(error).toBeNull();
    }

    // Rahul is free now for 2h.
    const slotId = crypto.randomUUID();
    const start = new Date();
    const end = new Date(start.getTime() + 2 * 3600_000);
    await rahul.client.from("slots").insert({
      id: slotId,
      squad_id: squad!.id,
      member_id: memberIds.Rahul,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
    });

    await notifyAboutNewSlot({ slotId, squadId: squad!.id, boardPath: `/s/${code}` });

    const byPath = Object.fromEntries(
      received.map((r) => {
        const { path, payload } = r.body as { path: string; payload: Record<string, string> };
        return [path, payload];
      }),
    );
    expect(Object.keys(byPath).sort()).toEqual(["/Arjun", "/Maya"]); // not Rahul

    const until = (tz: string) =>
      end.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
    expect(byPath["/Arjun"]).toEqual({
      title: "Rahul is free now",
      body: `For 2h, until ${until("Asia/Kolkata")} your time · Push crew`,
      url: `/s/${code}`,
      tag: `slot-${slotId}`,
    });
    expect(byPath["/Maya"].body).toBe(`For 2h, until ${until("America/Toronto")} your time · Push crew`);

    // A push service answering 410 Gone means the browser unsubscribed:
    // that row is cleaned up on the next send.
    received.length = 0;
    respondWith = 410;
    const again = crypto.randomUUID();
    await arjun.client.from("slots").insert({
      id: again,
      squad_id: squad!.id,
      member_id: memberIds.Arjun,
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 3600_000).toISOString(),
    });
    await notifyAboutNewSlot({ slotId: again, squadId: squad!.id, boardPath: `/s/${code}` });
    respondWith = 201;

    const admin = createClient(url, serviceRoleKey!, { auth: { persistSession: false } });
    const { data: left } = await admin
      .from("push_subscriptions")
      .select("member_id")
      .in("member_id", [memberIds.Arjun, memberIds.Maya]);
    // Rahul posted nothing new, so only Maya was sent to, and she got 410.
    expect(left).toEqual([{ member_id: memberIds.Arjun }]);
  });
});
