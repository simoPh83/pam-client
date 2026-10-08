# Session log — 2026-10-07

First-time local setup on this machine + leads page rework (project-grouped).

## Local environment setup (no admin rights available)

- **Node.js v24.19.0 (LTS)** installed as a *portable* zip to
  `%LOCALAPPDATA%\Programs\nodejs` (winget/MSI requires admin; portable zip
  does not). Added to the **user PATH** — new terminals pick it up
  automatically.
- **pnpm 12.9.1** activated via corepack (matches `packageManager` in
  `package.json`), then `pnpm install` (673 packages).
- `.env.local` created with `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `DATABASE_URL` (session pooler string;
  used only by `pnpm migrate` / `pnpm verify:db`, never by the app).
- **Windows Firewall** blocked `node.exe` (no admin to allow) — harmless for
  local dev: `http://localhost:3000` works; only the LAN "Network" URL is
  unreachable from other devices.
- `pnpm typecheck` and `pnpm verify:db` pass (leads view ~192k rows, all
  `ui_*` tables + RLS present).

## Leads page → project-grouped (spec: web-client-kickoff/04)

Decisions made together:
- Root status grouped: Approved (Permitted/Conditions), Not approved
  (Rejected/Withdrawn), Pending (Undecided), Other (rest) — computed in the
  DB view as `root_state_group`.
- Stars are **read-shared, write-own** (dimmed star = starred by a
  colleague); hidden + notes are **fully private**, per-user. All keyed by
  **project**, not application.
- `ui_lead_meta` dropped (test data only) — replaced by project-level tables.
- Extra columns adopted: project name/address + application-count badge.

### Migration `supabase/migrations/003_project_meta.sql` (applied)

- Drops `ui_lead_meta` (+ trigger).
- `ui_project_stars (user_id, project_id)` — RLS: read-all authenticated,
  insert/delete own rows only.
- `ui_project_meta (user_id, project_id, hidden, notes, updated_at)` — RLS:
  own rows only, all operations.
- `projects_feed` view (`security_invoker`): projects + root application
  (reference, description, `filed_date` = `start_date` w/ `first_seen`
  fallback, state, `root_state_group`) + latest application (reference,
  state, role via `project_applications`) + per-user flags
  (`starred_by_me`, `starred_by_others`, `hidden`).
- Indexes: `projects(last_updated desc nulls last)`,
  `projects(authority, last_updated desc nulls last)`,
  `projects(name asc nulls last)`.

### Code

- `lib/project-filters.ts` (new) — project filter model; default = updated in
  last 90 days (`updatedFrom=any` clears it).
- `lib/queries.ts` — `getProjectsFeed()` replaces `getLeads()`/`groupLeads()`;
  annotates root-missing projects from `missing_parents.status`
  (pending/found/exhausted); `getLeadDetail()` meta now project-level
  (star/hidden/notes via new tables, own-user star lookup).
- `lib/actions.ts` — `updateLeadMeta` replaced by `toggleProjectStar` +
  `updateProjectMeta`.
- `components/projects-table.tsx` / `projects-filters.tsx` (new);
  `leads-table.tsx` / `leads-filters.tsx` / `lib/filters.ts` deleted.
- `components/lead-meta-section.tsx` — now project-level; hidden when the
  application has no project.

### Fixed along the way

- Migration 001 was stale vs the live `leads` view (which had gained
  `project_id`/`n_applications`) → `CREATE OR REPLACE VIEW` failed with
  "cannot drop columns from view". Repo copy updated to match live; `pnpm
  migrate` is idempotent again.

### Performance debugging (57014 statement timeout)

The first UI test with an "Updated from" + "Approved" filter hit a statement
timeout. Root cause: PostgREST `count=exact` (needed for pagination) evaluates
the root-application join + star/hidden flags for **every matching row**, not
just the 50-row page. Fixes, all in migration 003:

- Covering index `applications(uid) include (app_state, start_date,
  reference)` → index-only root/latest lookups (the big win: 15–20s →
  sub-second for filtered counts).
- Index `ui_project_stars(project_id)` — the `starred_by_others` probe
  otherwise seq-scans per row (PK leads with `user_id`).
- Tested and **rejected** a pre-aggregated-joins view variant (`projects_feed
  _v2`): counts improved but page queries regressed ~100× (19s) because the
  planner materialised the joins before LIMIT. Kept per-row subqueries.

Timings as the authenticated user (via real JWT; `USERNAME_KEY`/
`USERNAME_PASS` in `.env.local` — gitignored — used for this testing only):
default page ~1.8s, updated+approved ~2.2s warm, borough+status ~2.4s, name
search ~1.4s. Further gains need worker-side denormalisation (see below).

## Scope notes / follow-ups

1. **Filed-date column is not sortable.** `filed_date` comes from the joined
   root application, so sorting forces a full join of ~160k projects →
   applications (~35s, times out). Proper fix is worker-side: add a
   denormalised `projects.filed_date` column (the backend spec
   `2026.10.05-backend-spec-new-features.md` §3 already anticipates this).
   Then expose it in `projects_feed` and re-enable the sortable header in
   `projects-table.tsx`.
2. **Search covers project name/address only.** Matching
   `root_description` too would force the same per-row join (~15s).
   Revisit with a `pg_trgm` trigram index or worker-denormalised column.
3. **Exact counts are the remaining hot path** (~2s warm for large result
   sets). If it ever feels sluggish, candidates: worker-denormalised
   `projects.root_state`, or approximate counts (`count=planned` — measured
   116ms but the estimate was 2× off, so display would be misleading).
4. **`last_updated` pollution (worker-side, spec drafted).** Parent-hunt /
   backfill inserts of *historical* applications stamp `last_updated` =
   discovery date, inflating `projects.last_updated` (109k of 160k projects
   "updated in the last 6 days" on 2026-10-07; real state changes are tens
   per day). Fix spec for the `pam` repo:
   `docs/2026-10-07-last-activity-semantics.md` (insert path should stamp the
   PlanIt event date + one-off cleanup SQL + acceptance criteria).

Query timings after indexing (160k projects, session pooler): default sort
~190ms, name sort ~365ms, name search ~1s, borough+status ~0.1–3s, filed
range ~2.5s, starred-only ~5s worst case (no stars yet). **Update:** those
were data-only timings as superuser; the exact **count** was the real hot
path in production — see "Performance debugging" above for final numbers.

## Not yet done (future sessions)

- Proper interactive test pass of the new leads page (user to run later).
- Project detail page tabs (spec §4), practices UI (§5), alerts inbox +
  settings (§6) — the `practices`/`project_practices`/`ui_alert_rules`/
  `ui_alerts` tables are not yet created (deliverable 1 of the spec).

# Session log — 2026-10-08

Practices integration (spec: docs/2026.10.08-practices-integration-brief.md,
updated this session with the agent-promotion addition).

Decisions made together:
- Assign-practice flow is a **centred modal** on the project page.
- Contacts belong to the practice and are **all available from the
  assignment** (no per-assignment contact selection in v1).
- Practices are **editable/removable by all** authenticated users; deletion
  blocked while project assignments exist (FK restrict).
- The project page's PlanIt agents block is **derived data** (query over
  `project_applications` → `applications`), not a stored field.

### Migration `supabase/migrations/004_practices.sql` (applied)

- `ui_practices` (name unique case-insensitively via `lower(name)` index,
  website, notes, attribution cols, `updated_at` trigger).
- `ui_practice_contacts` (practice_id FK cascade; name/email/phone/role/notes).
- `ui_project_practices` (project_id FK cascade, practice_id FK **restrict**,
  role + notes on the link, unique(project_id, practice_id)).
- RLS on all three: authenticated full access, anon revoked — same pattern
  as migration 002.
- `projects_feed` gains trailing `practice_status` column:
  `assigned` (exists ui_project_practices) overrides `agent` (any application
  in the project has non-blank, non-`?` PlanIt agent data) else `none`.
- Indexes: `project_applications(project_id, uid)`,
  `applications(uid) include (agent_company, agent_name)`,
  assignment/contact FK indexes.
- Smoke-tested at DB level (then cleaned up): duplicate practice name 23505,
  duplicate assignment 23505, delete-while-assigned 23503, contact cascade.

### Code

- `lib/types.ts` — `PracticeStatus`, `Practice`, `PracticeContact`,
  `ProjectPractice` (assignment + practice + contacts), `ProjectAgent`;
  `projects_feed` row gains `practice_status`.
- `lib/project-filters.ts` + `components/projects-filters.tsx` — new
  `practice` filter (any / none / agent / assigned).
- `components/projects-table.tsx` — practice icon column (muted building =
  none, amber user-search = agent present, emerald building = assigned).
- `lib/queries.ts` — `getProjectPractices()`, `getProjectAgents()`
  (dedupes by normalised company|person|address; strips stray quotes and
  `?` placeholders), `searchPractices()`; feed query applies practice filter.
- `lib/actions.ts` — practice/contact/assignment CRUD returning result
  objects (duplicate-name conflicts return the existing record so the UI can
  offer it; assignment revalidates `/lead` + `/`).
- `components/ui/dialog.tsx` (new shadcn primitive, radix-ui),
  `components/assign-practice-dialog.tsx` (search → select/create → contacts
  → role+note → assign, centred modal),
  `components/practices-section.tsx` (assignment cards: edit role/note, edit
  practice + delete, contacts add/edit/delete, two-step unassign),
  `components/project-agents.tsx` (read-only PlanIt agents block, labelled
  "read-only · application data").
- `app/(app)/lead/page.tsx` — persistent project-level row under the tabs:
  PracticesSection + ProjectAgents, rendered for every application tab.

Validation: `pnpm typecheck`, `pnpm lint` (only pre-existing TanStack
warning), `pnpm build` all pass. Live DB: ~75k/179k applications carry agent
data; ~33k/85k projects → `practice_status = 'agent'`.

## Not yet done (future sessions)

- Interactive browser test pass of the practice flows (needs sign-in).
- Practice **register page** (brief §5: search/list/edit all practices) —
  v1 manages practices from the project page only.
- True client-side application-tab switching so project context is not
  refetched (brief §2) — currently a full navigation per tab.

## Practice-status filter performance fix (same evening)

Filtering the feed by `practice_status` timed out (57014, >8s Supabase
statement timeout): the filter sits on a computed CASE column, so every
candidate row ran the per-member `applications` EXISTS probe (~20k candidates
× joins; 3.4s even warm as superuser, worse via PostgREST).

### Migration `supabase/migrations/005_agent_presence.sql` (applied)

- `ui_project_agent_presence (project_id pk)` — trigger-maintained cache of
  "project has ≥1 application with a meaningful PlanIt agent".
- Triggers on fetcher-owned `project_applications` (project_id/uid changes)
  and `applications` (agent_company/agent_name changes) recompute affected
  projects; `security definer` functions so the fetcher role can fire them.
  **Caveat:** if the fetcher ever drops/recreates those tables the triggers
  vanish — re-run `pnpm migrate` to restore (idempotent, refills the cache).
- `projects_feed.practice_status` now probes this PK table for 'agent'.
- Migration 003 switched to DROP+CREATE for the view (replays failed with
  "cannot drop columns from view" once 004 appended a column); the runner
  applies all files in order, so the final definition always wins.

Timings after fix (count, 90-day window, ~20.9k rows): default 1667ms,
assigned 185ms, agent 74ms, none 77ms; filtered page ~94ms. Cache verified
against ground truth (33,360 = 33,360). The default count (~1.7s warm)
remains the known exact-count hot path from 2026-10-07.
