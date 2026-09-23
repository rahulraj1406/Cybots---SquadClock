-- SquadClock schema: squads, members, slots, plus RLS so a device can
-- only ever see/write data for squads it has actually joined.
--
-- Identity model: every device signs in via Supabase anonymous auth
-- (no passwords). auth.uid() is stable per device and is what RLS
-- checks against — see docs/PROJECT.md section 3 ("Key decisions").

create table if not exists public.squads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  user_id uuid not null,
  display_name text not null check (char_length(display_name) between 1 and 40),
  timezone text not null,
  created_at timestamptz not null default now(),
  unique (squad_id, user_id)
);

create table if not exists public.slots (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  note text check (char_length(note) <= 140),
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (member_id, endpoint)
);

create index if not exists members_squad_id_idx on public.members(squad_id);
create index if not exists members_user_id_idx on public.members(user_id);
create index if not exists slots_squad_id_idx on public.slots(squad_id);
create index if not exists slots_ends_at_idx on public.slots(ends_at);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.squads enable row level security;
alter table public.members enable row level security;
alter table public.slots enable row level security;
alter table public.push_subscriptions enable row level security;

-- squads: readable/writable only once you're already a member. Discovery
-- of a squad by invite code goes through get_squad_by_invite_code()
-- below (SECURITY DEFINER), so an unauthenticated visitor never gets
-- direct table access to squads they haven't joined.
create policy "members can read their squad"
  on public.squads for select
  using (
    exists (
      select 1 from public.members m
      where m.squad_id = squads.id and m.user_id = auth.uid()
    )
  );

create policy "any signed-in device can create a squad"
  on public.squads for insert
  with check (auth.uid() is not null);

-- members: a member can see everyone else in their own squad(s), and can
-- insert only their own row (i.e. you can only add yourself as you, not
-- impersonate someone else joining).
create policy "members can read their squad roster"
  on public.members for select
  using (
    exists (
      select 1 from public.members me
      where me.squad_id = members.squad_id and me.user_id = auth.uid()
    )
  );

create policy "a device can add itself as a member"
  on public.members for insert
  with check (user_id = auth.uid());

create policy "a member can update their own row"
  on public.members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- slots: only members of a squad can read/write that squad's slots, and
-- only as themselves (member_id must map back to their own membership row).
create policy "members can read their squad's slots"
  on public.slots for select
  using (
    exists (
      select 1 from public.members m
      where m.squad_id = slots.squad_id and m.user_id = auth.uid()
    )
  );

create policy "members can post slots as themselves"
  on public.slots for insert
  with check (
    exists (
      select 1 from public.members m
      where m.id = slots.member_id
        and m.squad_id = slots.squad_id
        and m.user_id = auth.uid()
    )
  );

create policy "members can delete their own slots"
  on public.slots for delete
  using (
    exists (
      select 1 from public.members m
      where m.id = slots.member_id and m.user_id = auth.uid()
    )
  );

-- push_subscriptions: a member manages only their own subscriptions.
create policy "members can manage their own push subscriptions"
  on public.push_subscriptions for all
  using (
    exists (
      select 1 from public.members m
      where m.id = push_subscriptions.member_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.id = push_subscriptions.member_id and m.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- Invite-code lookup: SECURITY DEFINER so an unauthenticated / not-yet-
-- a-member visitor can resolve "abc123" -> {id, name} to land on the
-- join screen, without the squads table being publicly selectable.
-- ---------------------------------------------------------------------

create or replace function public.get_squad_by_invite_code(code text)
returns table (id uuid, name text)
language sql
security definer
set search_path = public
as $$
  select s.id, s.name
  from public.squads s
  where s.invite_code = code;
$$;

revoke all on function public.get_squad_by_invite_code(text) from public;
grant execute on function public.get_squad_by_invite_code(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Realtime: broadcast changes on slots and members so a squad board
-- updates live without a refresh (see docs/PROJECT.md section 4).
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table public.slots;
alter publication supabase_realtime add table public.members;

-- ---------------------------------------------------------------------
-- Housekeeping: callable by a daily cron (see docs/PROJECT.md "Later")
-- to drop slots that expired more than a day ago, keeping the tables
-- small. Not scheduled by default.
-- ---------------------------------------------------------------------

create or replace function public.purge_expired_slots()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.slots where ends_at < now() - interval '1 day';
$$;

revoke all on function public.purge_expired_slots() from public;
