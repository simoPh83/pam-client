-- Migration 003: project-level user metadata + projects_feed view.
--
-- Supersedes ui_lead_meta (application-level, shared): metadata moves to
-- project level and becomes per-user. ui_lead_meta held test data only and
-- is dropped without preservation.
--
-- Access model:
-- - ui_project_stars: READ-SHARED (everyone sees all stars for outreach
--   coordination), WRITE-OWN (insert/delete own rows only).
-- - ui_project_meta (hidden, notes): fully PRIVATE, own rows only.

drop trigger if exists ui_lead_meta_updated_at on public.ui_lead_meta;
drop table if exists public.ui_lead_meta;

-- Stars: one row per (user, project). Presence of the row = starred.
create table if not exists public.ui_project_stars (
  user_id uuid not null default auth.uid() references auth.users(id),
  project_id bigint not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

alter table public.ui_project_stars enable row level security;
revoke all on public.ui_project_stars from anon;
grant select, insert, delete on public.ui_project_stars to authenticated;

-- The feed's starred_by_others lookup probes by project_id per row; the PK
-- leads with user_id, so without this index each probe is a seq scan.
create index if not exists idx_ui_project_stars_project
  on public.ui_project_stars (project_id);

drop policy if exists "read all stars" on public.ui_project_stars;
create policy "read all stars" on public.ui_project_stars
  for select to authenticated using (true);

drop policy if exists "insert own star" on public.ui_project_stars;
create policy "insert own star" on public.ui_project_stars
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "delete own star" on public.ui_project_stars;
create policy "delete own star" on public.ui_project_stars
  for delete to authenticated using (auth.uid() = user_id);

-- Hidden + notes: private per-user project metadata.
create table if not exists public.ui_project_meta (
  user_id uuid not null default auth.uid() references auth.users(id),
  project_id bigint not null references public.projects(id) on delete cascade,
  hidden boolean not null default false,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

drop trigger if exists ui_project_meta_updated_at on public.ui_project_meta;
create trigger ui_project_meta_updated_at
  before update on public.ui_project_meta
  for each row execute function public.set_updated_at();

alter table public.ui_project_meta enable row level security;
revoke all on public.ui_project_meta from anon;
grant select, insert, update, delete on public.ui_project_meta to authenticated;

drop policy if exists "own rows only" on public.ui_project_meta;
create policy "own rows only" on public.ui_project_meta
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Single-query feed for the project-grouped leads table. security_invoker so
-- underlying RLS applies; ui_project_stars / ui_project_meta are resolved for
-- the calling user via auth.uid().
create or replace view public.projects_feed
with (security_invoker = true) as
select
  p.id,
  p.authority,
  p.name,
  p.n_applications,
  p.root_in_db,
  p.first_seen,
  p.last_updated,
  p.root_uid,
  p.latest_uid,
  root.reference as root_reference,
  root.description as root_description,
  coalesce(root.start_date, p.first_seen) as filed_date,
  root.app_state as root_state,
  latest.reference as latest_reference,
  latest.app_state as latest_state,
  la.role as latest_role,
  exists (
    select 1 from public.ui_project_stars s
    where s.project_id = p.id and s.user_id = auth.uid()
  ) as starred_by_me,
  exists (
    select 1 from public.ui_project_stars s
    where s.project_id = p.id and s.user_id <> auth.uid()
  ) as starred_by_others,
  coalesce((
    select m.hidden from public.ui_project_meta m
    where m.project_id = p.id and m.user_id = auth.uid()
  ), false) as hidden,
  -- Grouped root status for filtering; new app_state values fall into 'other'.
  -- Appended last: CREATE OR REPLACE VIEW can only add trailing columns.
  case
    when root.app_state in ('Permitted', 'Conditions') then 'approved'
    when root.app_state in ('Rejected', 'Withdrawn') then 'not_approved'
    when root.app_state = 'Undecided' then 'pending'
    else 'other'
  end as root_state_group
from public.projects p
left join public.applications root on root.uid = p.root_uid
left join public.applications latest on latest.uid = p.latest_uid
left join public.project_applications la
  on la.project_id = p.id and la.uid = p.latest_uid;

revoke all on public.projects_feed from anon;
grant select on public.projects_feed to authenticated;

-- The feed's default sort (last_updated desc) must scan projects in index
-- order and stop after one page; without this index Postgres joins all
-- ~160k projects to applications before sorting (~30s → ~0.5s).
create index if not exists idx_projects_last_updated
  on public.projects (last_updated desc nulls last);

-- Borough-filtered variant of the default sort.
create index if not exists idx_projects_authority_last_updated
  on public.projects (authority, last_updated desc nulls last);

-- Lets name-sorted pages scan in index order and join only the page's rows.
create index if not exists idx_projects_name
  on public.projects (name asc nulls last);

-- Covering index so root/latest joins can be served index-only. Without it,
-- exact counts over the feed that filter on root state (or filed date) fetch
-- the full applications row for every candidate (~15–20s → sub-second).
create index if not exists idx_applications_feed_cover
  on public.applications (uid) include (app_state, start_date, reference);
