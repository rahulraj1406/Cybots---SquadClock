import { createClient } from "@supabase/supabase-js";

/**
 * Daily ping (scheduled in vercel.json) that keeps a free-tier Supabase
 * project from pausing after ~7 days without activity (docs/PROJECT.md,
 * "Later"). It makes one cheap database round-trip through the public
 * invite-code lookup: no session, no writes.
 *
 * If a CRON_SECRET env var is set, Vercel sends it as a bearer token and
 * anything else is refused, so the endpoint can't be used by others to
 * generate traffic.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return Response.json({ ok: false, error: "Supabase env vars missing" }, { status: 500 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase.rpc("get_squad_by_invite_code", { code: "keepalive" });

  if (error) {
    console.error("keepalive: Supabase ping failed", error);
    return Response.json({ ok: false, error: error.message }, { status: 502 });
  }
  return Response.json({ ok: true, at: new Date().toISOString() });
}
