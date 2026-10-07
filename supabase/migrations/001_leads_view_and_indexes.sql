-- Migration 001: read-side performance indexes and the canonical `leads` view.
-- Fetcher tables are read-only for this app (RLS already applied by the worker
-- repo's scripts/rls.sql). We only ADD indexes and a view; no writes to data.

-- Indexes (dates are TEXT ISO, which sorts correctly as text).
create index if not exists idx_applications_state_decided
  on public.applications (app_state, decided_date desc);
create index if not exists idx_applications_authority
  on public.applications (authority);
create index if not exists idx_applications_size
  on public.applications (app_size);
create index if not exists idx_applications_agent_display
  on public.applications (agent_display);
create index if not exists idx_applications_postcode
  on public.applications (postcode);
create index if not exists idx_state_history_uid
  on public.state_history (uid);

-- Leads view: approved schemes (Permitted or Conditions), excluding Trees.
-- security_invoker = true so RLS on the base table applies to the caller.
-- Columns must match the live view exactly (it was extended with project_id
-- and n_applications after this migration first shipped) so that re-applying
-- stays a no-op — CREATE OR REPLACE VIEW cannot drop columns.
create or replace view public.leads
  with (security_invoker = true) as
select a.uid,
       a.reference,
       a.authority,
       a.address,
       a.postcode,
       a.description,
       a.app_type,
       a.app_size,
       a.app_state,
       a.decided_date,
       a.agent_display,
       a.agent_name,
       a.agent_company,
       a.agent_address,
       a.applicant_name,
       a.lat,
       a.lng,
       a.n_dwellings,
       a.first_seen,
       a.last_updated,
       pa.project_id,
       p.n_applications
from public.applications a
left join public.project_applications pa on pa.uid = a.uid
left join public.projects p on p.id = pa.project_id
where a.app_state in ('Permitted', 'Conditions')
  and coalesce(a.app_type, '') <> 'Trees';

revoke all on public.leads from anon;
grant select on public.leads to authenticated;
