# SquadClock

Post "free now for 2h" once — everyone in your squad sees it in their own
local time zone, with overlaps highlighted automatically. See
[`docs/PROJECT.md`](docs/PROJECT.md) for the full brief.

## Stack

Next.js 16 (App Router, TypeScript) · Supabase (Postgres + anonymous auth +
Realtime) · Tailwind CSS v4 · Luxon.

## Local setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
   (free tier is enough).
2. **Enable anonymous sign-in**: Authentication -> Sign In / Providers ->
   turn on "Anonymous Sign-Ins".
3. **Run the schema**: Supabase dashboard -> SQL Editor -> paste the
   contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   -> Run.
4. **Copy your API keys**: Project Settings -> API -> copy the Project URL
   and the `anon` `public` key.
5. **Set env vars**: `cp .env.example .env.local` and fill in the two
   values from step 4.
6. **Install and run**:
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000.

## Tests

```bash
npm run test       # run once
npm run test:watch # watch mode
```

Pure logic (timezone math, overlap detection, the WhatsApp message
builder) is covered under `src/lib/__tests__`.

## Deploying

Push to GitHub, then import the repo in [Vercel](https://vercel.com/new).
Add the same two env vars from `.env.local` in the Vercel project
settings. Every push to `main` deploys automatically.

Supabase free projects pause after ~7 days of inactivity — see
`docs/PROJECT.md` "Later" section for a cron-based keep-alive.
