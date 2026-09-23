-- Fixes "infinite recursion detected in policy for relation members".
--
-- The original "members can read their squad roster" policy let a
-- member see the rest of their squad's roster with a self-join:
--   exists (select 1 from members me where me.squad_id = members.squad_id
--           and me.user_id = auth.uid())
-- Because that policy is defined ON members and also QUERIES members,
-- Postgres re-applies the same policy to the inner reference, which
-- re-applies it again, and so on — an infinite loop that Postgres
-- detects and rejects. In practice this broke nearly everything: every
-- squad/join page load calls getCurrentMember(), which reads from
-- members, so it failed as soon as a squad had a member.
--
-- Fix: a SECURITY DEFINER helper function reads the membership table as
-- its owner (bypassing RLS internally), so the cycle never triggers.
-- Run this whole file once in the Supabase SQL Editor.

create or replace function public.my_squad_ids()
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select squad_id from public.members where user_id = (select auth.uid());
$$;

revoke all on function public.my_squad_ids() from public;
grant execute on function public.my_squad_ids() to anon, authenticated;

drop policy if exists "members can read their squad roster" on public.members;
create policy "members can read their squad roster"
  on public.members for select
  using (squad_id in (select public.my_squad_ids()));

-- Not recursive on their own (they reference members, not themselves),
-- but switched to the same helper to avoid a repeated correlated
-- subquery per row and to stay consistent with the members policy above.
drop policy if exists "members can read their squad" on public.squads;
create policy "members can read their squad"
  on public.squads for select
  using (id in (select public.my_squad_ids()));

drop policy if exists "members can read their squad's slots" on public.slots;
create policy "members can read their squad's slots"
  on public.slots for select
  using (squad_id in (select public.my_squad_ids()));
