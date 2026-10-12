-- Migration 004: shared practice register + project assignments + contacts,
-- and a three-state practice_status column on projects_feed.
--
-- Access model (like ui_outreach in 002): practices, contacts and assignments
-- are SHARED between all signed-in users — no ownership hierarchy.
-- `created_by`/`created_by_email` are recorded for attribution only.
--
-- Docs: docs/2026-10-08-practices-integration-brief.md

-- Shared practice records.
create table if not exists public.ui_practices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_by_email text,             -- captured at insert time for display
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Practice names are unique case-insensitively.
create unique index if not exists ui_practices_name_unique
  on public.ui_practices (lower(name));

drop trigger if exists ui_practices_updated_at on public.ui_practices;
create trigger ui_practices_updated_at
  before update on public.ui_practices
  for each row execute function public.set_updated_at();

-- Contacts belong to exactly one practice (v1); they are shared like
-- practices. Cascade: contacts go away with their practice, but practice
-- deletion is blocked while project assignments exist (restrict below).
create table if not exists public.ui_practice_contacts (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.ui_practices(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role text,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_by_email text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ui_practice_contacts_practice
  on public.ui_practice_contacts (practice_id);

-- Project-to-practice assignment; carries the project-specific role + note.
create table if not exists public.ui_project_practices (
  id uuid primary key default gen_random_uuid(),
  project_id bigint not null references public.projects(id) on delete cascade,
  practice_id uuid not null references public.ui_practices(id) on delete restrict,
  role text,                         -- free text, e.g. "main architect"
  notes text,                        -- project-specific note
  created_by uuid not null default auth.uid() references auth.users(id),
  created_by_email text,
  created_at timestamptz not null default now(),
  unique (project_id, practice_id)
);
create index if not exists idx_ui_project_practices_project
  on public.ui_project_practices (project_id);
create index if not exists idx_ui_project_practices_practice
  on public.ui_project_practices (practice_id);

-- RLS: anon gets nothing; any authenticated user can read/write all rows.
do $$
declare t text;
begin
  foreach t in array array['ui_practices', 'ui_practice_contacts', 'ui_project_practices']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "authenticated full access" on public.%I', t);
    execute format(
      'create policy "authenticated full access" on public.%I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- Indexes supporting the per-project probes in projects_feed below and the
-- project page's aggregated PlanIt agents query.
create index if not exists idx_project_applications_project_uid
  on public.project_applications (project_id, uid);
create index if not exists idx_applications_agent_cover
  on public.applications (uid) include (agent_company, agent_name);

-- Append practice_status to projects_feed (CREATE OR REPLACE VIEW can only
-- add trailing columns; the rest of the definition is unchanged from 003).
-- 'assigned' overrides 'agent'. '?' and blank agent values are PlanIt
-- placeholders and do not count as agent present.
-- Note: filtering on 'assigned' can semi-join from ui_project_practices
-- (few rows); filtering on 'agent' probes per candidate project — acceptable
-- while the agent_cover index keeps the probe index-only.
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
      select 1
      from public.project_applications pa
      join public.applications a on a.uid = pa.uid
      where pa.project_id = p.id
        and (
          (a.agent_company is not null and btrim(a.agent_company) not in ('', '?'))
          or (a.agent_name is not null and btrim(a.agent_name) not in ('', '?'))
        )
    ) then 'agent'
    else 'none'
  end as practice_status
from public.projects p
left join public.applications root on root.uid = p.root_uid
left join public.applications latest on latest.uid = p.latest_uid
left join public.project_applications la
  on la.project_id = p.id and la.uid = p.latest_uid;
