-- Migration 005: trigger-maintained project→agent-presence cache.
--
-- Why: projects_feed.practice_status (004) probes applications per project
-- member on every candidate row; filtering the feed by practice_status timed
-- out (>8s Supabase statement timeout) on the exact-count path. This table
-- reduces the "project has a meaningful PlanIt agent" question to a single
-- PK lookup.
--
-- Maintenance: triggers on fetcher-owned `applications` and
-- `project_applications`. If the fetcher ever drops/recreates those tables,
-- the triggers vanish — re-run `pnpm migrate` to restore them (all
-- statements here are idempotent) and re-fill from scratch.

create table if not exists public.ui_project_agent_presence (
  project_id bigint primary key references public.projects(id) on delete cascade
);

alter table public.ui_project_agent_presence enable row level security;
revoke all on public.ui_project_agent_presence from anon;
grant select on public.ui_project_agent_presence to authenticated;
drop policy if exists "read presence" on public.ui_project_agent_presence;
create policy "read presence" on public.ui_project_agent_presence
  for select to authenticated using (true);

-- A PlanIt agent value counts as present when company or person is non-blank
-- and not the "?" placeholder.
create or replace function public.has_meaningful_agent(
  p_company text, p_name text
) returns boolean
language sql immutable as $$
  select (p_company is not null and btrim(p_company) not in ('', '?'))
      or (p_name is not null and btrim(p_name) not in ('', '?'))
$$;

create or replace function public.recompute_project_agent_presence(
  p_project_id bigint
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1
    from public.project_applications pa
    join public.applications a on a.uid = pa.uid
    where pa.project_id = p_project_id
      and public.has_meaningful_agent(a.agent_company, a.agent_name)
  ) then
    insert into public.ui_project_agent_presence (project_id)
    values (p_project_id)
    on conflict do nothing;
  else
    delete from public.ui_project_agent_presence
    where project_id = p_project_id;
  end if;
end $$;

create or replace function public.trg_project_applications_agent_presence()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recompute_project_agent_presence(new.project_id);
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    perform public.recompute_project_agent_presence(old.project_id);
  end if;
  return null;
end $$;

drop trigger if exists ui_agent_presence_pa on public.project_applications;
create trigger ui_agent_presence_pa
  after insert or delete or update of project_id, uid
  on public.project_applications
  for each row execute function public.trg_project_applications_agent_presence();

create or replace function public.trg_applications_agent_presence()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p_uid text;
  p_project bigint;
begin
  if tg_op = 'DELETE' then p_uid := old.uid; else p_uid := new.uid; end if;
  for p_project in
    select project_id from public.project_applications where uid = p_uid
  loop
    perform public.recompute_project_agent_presence(p_project);
  end loop;
  return null;
end $$;

drop trigger if exists ui_agent_presence_app on public.applications;
create trigger ui_agent_presence_app
  after insert or delete or update of agent_company, agent_name
  on public.applications
  for each row execute function public.trg_applications_agent_presence();

-- Initial fill.
insert into public.ui_project_agent_presence (project_id)
select distinct pa.project_id
from public.project_applications pa
join public.applications a on a.uid = pa.uid
where public.has_meaningful_agent(a.agent_company, a.agent_name)
on conflict do nothing;

-- Point projects_feed at the cache: same definition as 004, but the 'agent'
-- branch is a single PK probe instead of a join over the project's members.
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
  end as practice_status
from public.projects p
left join public.applications root on root.uid = p.root_uid
left join public.applications latest on latest.uid = p.latest_uid
left join public.project_applications la
  on la.project_id = p.id and la.uid = p.latest_uid;
