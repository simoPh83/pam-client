-- Migration 002: UI-owned tables. The fetcher owns `applications` etc. and can
-- be wiped/re-run at any time; these `ui_*` tables hold the human data and link
-- to applications by `uid` as a soft reference (no FK, no cascading deletes).
--
-- Access model (v1): outreach is SHARED between all signed-in users.
-- `created_by`/`created_by_email` are recorded for logging only; a later phase
-- may restrict contacting the same lead by different users.

create table if not exists public.ui_outreach (
  id uuid primary key default gen_random_uuid(),
  uid text not null,                 -- applications.uid (soft link)
  contacted_at timestamptz not null default now(),
  channel text,                      -- email | phone | linkedin | other
  to_name text,
  to_email text,
  status text not null default 'contacted', -- contacted|replied|follow_up|won|lost|no_interest
  follow_up_on date,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_by_email text,             -- captured at insert time for display
  created_at timestamptz not null default now()
);
create index if not exists idx_ui_outreach_uid on public.ui_outreach (uid);
create index if not exists idx_ui_outreach_follow_up
  on public.ui_outreach (status, follow_up_on);

-- Per-lead state shared across users (star, hide, notes).
create table if not exists public.ui_lead_meta (
  uid text primary key,              -- applications.uid (soft link)
  starred boolean not null default false,
  hidden boolean not null default false,
  notes text,
  updated_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now()
);

-- Saved filter presets for the leads table.
create table if not exists public.ui_saved_filters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  params jsonb not null,             -- URL search params as a JSON object
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

-- Keep ui_lead_meta.updated_at fresh.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists ui_lead_meta_updated_at on public.ui_lead_meta;
create trigger ui_lead_meta_updated_at
  before update on public.ui_lead_meta
  for each row execute function public.set_updated_at();

-- RLS: anon gets nothing; any authenticated user can read/write all rows.
do $$
declare t text;
begin
  foreach t in array array['ui_outreach', 'ui_lead_meta', 'ui_saved_filters']
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
