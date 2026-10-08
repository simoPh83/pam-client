-- Migration 006: trigram index for free-text search over application
-- descriptions (projects list "description" filter).
--
-- projects_feed.root_description comes from the joined root application;
-- without a trigram index an ILIKE '%…%' filter seq-scans applications
-- (~15s). pg_trgm makes substring search index-assisted. Supabase convention:
-- extensions live in the `extensions` schema; the opclass is qualified
-- accordingly (ILIKE needs no search_path changes — index usage is baked
-- into the index definition).
--
-- Build is one-off and takes a couple of minutes on ~179k rows.

create extension if not exists pg_trgm with schema extensions;

-- NOTE (superseded same day by 007): the trigram index on descriptions was
-- dropped again in 007 — unusable for common terms ("erection" ≈ 41k
-- matches, heap rechecks push counts past the API timeout). 007 replaces it
-- with a per-project precomputed tsvector. The extension is kept (cheap,
-- may serve future fuzzy matching).

-- Lets the planner drive description-filtered feed queries from the
-- applications side and nested-loop into projects by root_uid.
create index if not exists idx_projects_root_uid
  on public.projects (root_uid);
