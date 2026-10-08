-- Migration 007: replace trigram description search with a precomputed
-- tsvector per project + raise the API statement timeout.
--
-- Why:
-- 1. Trigram ILIKE on applications.description is unusable for common terms
--    ("erection" matches ~41k rows; heap rechecks make the count >10s).
-- 2. Filtering projects_feed on a FTS condition over the joined root
--    application never flips to an FTS-first plan: Postgres drives from
--    projects (last_updated index) and tsvectorizes each candidate's
--    description row-by-row (~18s for common terms). Instead of fighting the
--    planner, this makes the per-row probe cheap: a PK lookup into
--    ui_project_root_tsv + @@ on a stored tsvector.
-- 3. The statement timeout for the `authenticated` API role is raised 8s →
--    60s (product decision: users prefer slow over failed queries).
--
-- Maintenance caveat (same as 005): triggers live on fetcher-owned
-- `applications`/`projects`; if the fetcher recreates those tables, re-run
-- `pnpm migrate` to restore.

-- 1. Statement timeout (idempotent role setting).
alter role authenticated set statement_timeout = '60s';

-- 2. Per-project tsvector of the ROOT application's description.
create table if not exists public.ui_project_root_tsv (
  project_id bigint primary key references public.projects(id) on delete cascade,
  tsv tsvector not null
);
-- For flipped (FTS-first) plans when a query is selective.
create index if not exists idx_ui_project_root_tsv_gin
  on public.ui_project_root_tsv using gin (tsv);

alter table public.ui_project_root_tsv enable row level security;
revoke all on public.ui_project_root_tsv from anon;
grant select on public.ui_project_root_tsv to authenticated;
drop policy if exists "read root tsv" on public.ui_project_root_tsv;
create policy "read root tsv" on public.ui_project_root_tsv
  for select to authenticated using (true);

create or replace function public.refresh_project_root_tsv(p_project_id bigint)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tsv tsvector;
begin
  select to_tsvector('english', coalesce(a.description, ''))
    into v_tsv
  from public.projects p
  left join public.applications a on a.uid = p.root_uid
  where p.id = p_project_id;

  if v_tsv is null then
    -- Project gone (shouldn't happen — cascade handles deletes).
    delete from public.ui_project_root_tsv where project_id = p_project_id;
  else
    insert into public.ui_project_root_tsv (project_id, tsv)
    values (p_project_id, v_tsv)
    on conflict (project_id) do update set tsv = excluded.tsv
    where public.ui_project_root_tsv.tsv is distinct from excluded.tsv;
  end if;
end $$;

-- Root pointer changes (parent-hunt resolution, reclassification).
create or replace function public.trg_projects_root_tsv()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_project_root_tsv(new.id);
  return null;
end $$;

drop trigger if exists ui_root_tsv_projects on public.projects;
create trigger ui_root_tsv_projects
  after insert or update of root_uid on public.projects
  for each row execute function public.trg_projects_root_tsv();

-- Description text changes on an application that is a project root.
create or replace function public.trg_applications_root_tsv()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p_uid text;
  p_project bigint;
begin
  if tg_op = 'DELETE' then p_uid := old.uid; else p_uid := new.uid; end if;
  for p_project in
    select id from public.projects where root_uid = p_uid
  loop
    perform public.refresh_project_root_tsv(p_project);
  end loop;
  return null;
end $$;

drop trigger if exists ui_root_tsv_applications on public.applications;
create trigger ui_root_tsv_applications
  after insert or delete or update of description on public.applications
  for each row execute function public.trg_applications_root_tsv();

-- Initial fill (only roots that currently have a description).
insert into public.ui_project_root_tsv (project_id, tsv)
select p.id, to_tsvector('english', coalesce(a.description, ''))
from public.projects p
join public.applications a on a.uid = p.root_uid
where a.description is not null
on conflict (project_id) do nothing;

-- 3. Superseded by ui_project_root_tsv — drop the per-application text
-- indexes (GIN on long text costs the fetcher on every sync).
drop index if exists public.idx_applications_description_trgm;
drop index if exists public.idx_applications_description_fts;

-- 4. Expose the stored tsvector on the feed (trailing column; PostgREST
-- textSearch on a tsvector column uses it directly: col @@ to_tsquery(...)).
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
  case
    when root.app_state in ('Permitted', 'Conditions') then 'approved'
    when root.app_state in ('Rejected', 'Withdrawn') then 'not_approved'
    when root.app_state = 'Undecided' then 'pending'
    else 'other'
  end as root_state_group,
  case
    when exists (
      select 1 from public.ui_project_practices pp
      where pp.project_id = p.id
    ) then 'assigned'
    when exists (
      select 1 from public.ui_project_agent_presence ap
      where ap.project_id = p.id
    ) then 'agent'
    else 'none'
  end as practice_status,
  (
    select t.tsv from public.ui_project_root_tsv t
    where t.project_id = p.id
  ) as root_description_tsv
from public.projects p
left join public.applications root on root.uid = p.root_uid
left join public.applications latest on latest.uid = p.latest_uid
left join public.project_applications la
  on la.project_id = p.id and la.uid = p.latest_uid;
