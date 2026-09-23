# SquadClock — Project Brief

> Working name. A small web app that lets a gaming squad spread across time zones say
> "I'm free" once, and have everyone else see it in **their own** local time.

---

## 1. The problem

Three friends play Brawl Stars together from **India**, **Toronto** and **Dublin**.

- Today we coordinate on WhatsApp: *"I'm free 16 hours from now"*, *"I'm free Sunday morning"*,
  *"I'm free for the next 4 hours"*.
- Every message forces the others to do time-zone math, and people get it wrong.
- Daylight saving makes it worse: India never changes, Dublin and Toronto change on
  **different dates**, so the gap between us shifts during the year.
- Nobody plays only at "normal" hours. Someone might be up at 2 AM or 4 AM, so we can't just
  pick a fixed "sensible" window. We need to see real availability.

## 2. What we're building

A web app (installable on phones) where:

1. Someone creates a **squad** and shares an **invite link**.
2. Each person joins with a name. Their **time zone is detected automatically**.
3. Anyone posts an **availability slot** the way we already talk:
   - "Free **now** for 2h"
   - "Free **in 16h** for 3h"
   - "Free **Sun 8–10 AM**" (in my own time)
4. Everyone sees every slot **in their own local time**, plus how far away it is (*"in 16h"*).
5. The app **highlights overlaps**: when all 3 of us are free, and also when 2 of 3 are.
6. **Share to WhatsApp** turns a slot into a message with everyone's local time already
   filled in.
7. *(Phase 2)* **Push notifications**: "Arjun is free now", "All 3 overlap Sun 3 PM your time".

### What it is NOT (for now)
- Not a public product with accounts and passwords.
- No repeating weekly schedules. Slots are one-offs and **expire when they end**.
- No WhatsApp bot (it would need WhatsApp's paid business API).

## 3. Key decisions (already made)

| Decision | Choice | Why |
|---|---|---|
| Who it's for | Any squad, joined by invite link | Barely more work than a single-squad app; other squads could use it |
| Login | **No passwords.** Each device gets an anonymous identity | Frictionless for friends; still secure per squad |
| Availability type | One-off slots only | Matches how we already talk; always up to date |
| Input style | Relative ("in 16h for 3h") **and** absolute (pick date/time) | We use both today |
| Alerts | Phase 1: WhatsApp share. Phase 2: phone push | Ship something useful fast, then add push |
| Hosting | Vercel (free Hobby plan) | Free, and pushing to GitHub deploys the app |

## 4. Tech stack

| Layer | Tool | Notes |
|---|---|---|
| App + API | **Next.js** (App Router, TypeScript) | Hosted on Vercel |
| Database | **Supabase** Postgres (free plan) | Stores squads, members, slots |
| Identity | Supabase **anonymous sign-in** | Every device is a user, with no password. Row-level security keeps squads private |
| Live updates | Supabase **Realtime** | A friend's new slot appears instantly, no refresh |
| Time zones | Browser `Intl` API + **Luxon** | Reliable time-zone and daylight-saving math |
| Push (Phase 2) | **Web Push** (VAPID keys + service worker) | Free. iPhone needs "Add to Home Screen" (iOS 16.4+) |
| Styling | Tailwind CSS | Fast to build, mobile-first |

**Cost:** $0 at our scale. Optional custom domain is about $10–15/year.
⚠️ Supabase pauses free projects after about 7 days without activity. It's restored with one
click, or prevented with a daily Vercel cron ping (see Later).

## 5. The one rule for time: store UTC, display local

- Every slot is saved as **`starts_at` / `ends_at` in UTC** (`timestamptz`).
- Each member saves their **IANA time zone name** (e.g. `Asia/Kolkata`, `America/Toronto`,
  `Europe/Dublin`). **Never a fixed offset** like `+5:30`, because offsets change with daylight saving.
- Conversion happens **only when displaying**, in the viewer's browser.
- Always show a label so nobody is unsure: *"Sun 3:00 PM (your time) · in 2d 4h"*.

## 6. Data model (high level)

```
squads
  id, name, invite_code, created_at

members
  id, squad_id, user_id (anonymous auth), display_name, timezone, created_at

slots
  id, squad_id, member_id, starts_at (UTC), ends_at (UTC), note, created_at

push_subscriptions            ← Phase 2
  id, member_id, endpoint, keys, created_at
```

Overlap is **calculated, not stored**: take the live slots for a squad, find the time ranges
where 2 or 3 members are free together.

## 7. Screens

1. **Home**: "Create a squad" or paste an invite link.
2. **Join**: enter your name, confirm your detected time zone (editable).
3. **Squad board** (main screen):
   - 🟢 **Overlaps** at the top (all 3, then 2 of 3)
   - Each member's upcoming slots in *your* time, with their own local time shown small
   - Quick buttons: **Free now for 1h / 2h / 4h**
   - **+ Add slot**: "in __h for __h" or pick a date and time
   - **Share to WhatsApp** on any slot or overlap
4. *(Phase 2)* **Settings**: turn notifications on/off, choose which alerts you get.

Example WhatsApp message produced by the share button:

```
🎮 Rahul is free Sun 8:00–10:00 AM (Dublin)
🇮🇳 India: 12:30–2:30 PM
🇨🇦 Toronto: 3:00–5:00 AM
Join the squad: https://squadclock.vercel.app/s/abc123
```

## 8. Recommended build steps

### Step 0 · Setup (you, ~30 min)
- [ ] Create free accounts: **GitHub**, **Vercel**, **Supabase**
- [ ] Create a new GitHub repo and a new Supabase project
- [ ] Connect the repo to Vercel

### Phase 1 · The useful app (~1 day)
- [ ] **1. Scaffold & deploy early**: Next.js + Tailwind, deploy a "hello" page to Vercel on day one
- [ ] **2. Database**: create the tables, turn on anonymous sign-in, add row-level security rules
- [ ] **3. Create & join a squad**: invite link, name, auto-detected time zone
- [ ] **4. Post a slot**: "now for Xh", "in Xh for Yh", date/time picker, all saved as UTC
- [ ] **5. Squad board**: everyone's slots shown in the viewer's time, with "in Xh" countdowns
- [ ] **6. Overlap finder**: highlight all-3 and 2-of-3 windows
- [ ] **7. Live updates**: new slots appear instantly via Supabase Realtime
- [ ] **8. Share to WhatsApp**: pre-filled message with each member's local time
- [ ] **9. Test with the squad**: all three use it for a few days; fix what's annoying

### Phase 2 · Push notifications (~1 day)
- [ ] **10. Make it installable (PWA)**: app manifest, icons, service worker
- [ ] **11. Web Push setup**: generate VAPID keys, save each device's subscription
- [ ] **12. Send alerts** when someone posts "free now" and when a new all-3 overlap appears
- [ ] **13. Test on real phones**: Android + iPhone (Add to Home Screen first)

### Later (only if we want them)
- [ ] Daily Vercel cron to keep Supabase awake and clean up expired slots
- [ ] Quiet hours per person (optional, since some of us *want* 2 AM pings)
- [ ] Discord bot (`/free 4h`)
- [ ] Custom domain

## 9. How we'll know it works

- Posting "I'm free in 16h for 3h" takes **under 10 seconds**.
- Nobody in the squad does time-zone math by hand again.
- Times stay correct across the daylight-saving change dates
  (**Oct 25, 2026**: Dublin; **Nov 1, 2026**: Toronto).
- When all three are free at the same time, everyone finds out without anyone having to ask.

## 10. Open questions (decide as we go)

- Final app name
- 12-hour or 24-hour clock (or a per-person setting)
- Longest allowed slot (e.g. 12h?) and how far ahead you can post (e.g. 14 days?)
- Which alerts are on by default in Phase 2
