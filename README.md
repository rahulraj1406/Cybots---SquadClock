# SquadClock

Post "free now for 2h" once, and everyone in your squad sees it in their own
local time zone, with overlaps highlighted automatically. See
[`docs/PROJECT.md`](docs/PROJECT.md) for the full brief.

## Stack

Next.js 16 (App Router, TypeScript) · Supabase (Postgres + anonymous auth +
Realtime) · Tailwind CSS v4 · Luxon.

## Set up Supabase (hosted project)

All three steps are required. Skipping step 2 is the most common failure:
creating a squad then shows "Anonymous sign-ins are turned off…" (older
builds showed "Minified React error #441").

1. **Create a project** at [supabase.com](https://supabase.com). The free
   tier is enough.
2. **Enable anonymous sign-ins**: Authentication → Sign In / Providers →
   turn on **Allow anonymous sign-ins** → Save. Every device gets an
   anonymous identity instead of a password. New projects have this off,
   and it can't be set from SQL.
3. **Run the schema**: SQL Editor → paste all of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   → Run. The file is safe to run again at any time, for example to bring an
   older project up to date.

**Check it:** paste [`supabase/verify.sql`](supabase/verify.sql) into the SQL
Editor and run it. It's read-only and prints one row per requirement. Every
row should say `ok = true`; any that don't say how to fix them. The
"anonymous sign-in has succeeded" row only turns true after the first squad
is created or joined.

## Run locally

1. Copy your keys from Project Settings → API (Project URL and the `anon`
   `public` key).
2. `cp .env.example .env.local` and fill them in.
3. Install and run:
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000.

### Or against a local Supabase (Docker)

```bash
npx supabase start   # Postgres, Auth, REST, Realtime; applies the migrations
npx supabase status  # prints the local API URL and anon key for .env.local
```

The local stack comes from [`supabase/config.toml`](supabase/config.toml),
with anonymous sign-ins already on.

## Tests

```bash
npm test                  # unit tests: time zones, overlaps, share messages, actions
npm run test:integration  # RLS, auth and realtime against a local Supabase (needs `npx supabase start`)
```

CI runs lint, unit tests and a production build, plus the integration
suite on a fresh Supabase stack, where it also re-applies the schema and
runs `verify.sql`.

## Deploy

Import the repo in [Vercel](https://vercel.com/new) and add
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under
Project Settings → Environment Variables. Every push to `main` deploys.

Supabase free projects pause after about 7 days without activity. The
daily cron in [`vercel.json`](vercel.json) keeps the project awake.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Anonymous sign-ins are turned off for this Supabase project" | Auth setting off (the default) | Supabase → Authentication → Sign In / Providers → Allow anonymous sign-ins |
| "Minified React error #441" on an old deploy | A Server Action threw on the server; production hides the message | Redeploy the latest `main`, which shows the real error inline. The full error is also in Vercel → Project → Logs |
| `infinite recursion detected in policy for relation "members"` | Schema from before the recursion fix | Re-run `0001_init.sql` (or `0002_fix_members_rls_recursion.sql`) |
| Friends' slots only show after a refresh | Realtime isn't publishing the tables | Re-run `0001_init.sql`, then check `verify.sql` |
| Every page errors on Vercel | Env vars missing or misspelled | Set both `NEXT_PUBLIC_SUPABASE_*` vars and redeploy |
