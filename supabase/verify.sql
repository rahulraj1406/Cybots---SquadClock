-- SquadClock setup check. Paste into Supabase -> SQL Editor -> Run.
-- Read-only: it changes nothing. Every row should say ok = true; the
-- "fix" column says what to do for any that don't.

with checks(sort, check_name, ok, fix) as (
  select 1, 'table public.' || t || ' exists',
         to_regclass('public.' || t) is not null,
         'Run supabase/migrations/0001_init.sql'
  from unnest(array['squads', 'members', 'slots', 'push_subscriptions']) as t

  union all
  select 2, 'row level security on public.' || c.relname,
         c.relrowsecurity,
         'Run supabase/migrations/0001_init.sql'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('squads', 'members', 'slots', 'push_subscriptions')

  union all
  select 3, 'function public.' || f || '() exists',
         exists (
           select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = f and p.prosecdef
         ),
         'Run supabase/migrations/0001_init.sql'
  from unnest(array['my_squad_ids', 'get_squad_by_invite_code']) as f

  union all
  -- The original roster policy was a self-join on members, which fails
  -- with "infinite recursion detected in policy for relation members".
  select 4, 'members roster policy is non-recursive',
         exists (
           select 1 from pg_policies
           where schemaname = 'public' and tablename = 'members'
             and policyname = 'members can read their squad roster'
             and qual like '%my_squad_ids%'
         ),
         'Run supabase/migrations/0002_fix_members_rls_recursion.sql'

  union all
  select 5, 'policies present on public.' || t,
         (select count(*) from pg_policies where schemaname = 'public' and tablename = t) >= n,
         'Run supabase/migrations/0001_init.sql'
  from (values ('squads', 2), ('members', 3), ('slots', 3), ('push_subscriptions', 1)) as v(t, n)

  union all
  select 6, 'realtime publishes public.' || t,
         exists (
           select 1 from pg_publication_tables
           where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
         ),
         'Run supabase/migrations/0001_init.sql'
  from unnest(array['slots', 'members']) as t

  union all
  -- Anonymous sign-ins are an Auth setting, not SQL, so this can only
  -- tell whether one has ever succeeded. false on a brand-new project is
  -- expected until someone creates or joins a squad.
  select 7, 'at least one anonymous sign-in has succeeded',
         exists (select 1 from auth.users where is_anonymous),
         'Authentication -> Sign In / Providers -> enable "Allow anonymous sign-ins"'
)
select check_name, ok, case when ok then '' else fix end as fix
from checks
order by sort, check_name;
