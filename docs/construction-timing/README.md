# Construction timing research — brief

**Started:** 2026-10-10 · **Status:** exploratory (no code, no schema changes)

## Goal

Estimate, per **project** (a cluster of planning applications on one site):

1. **Start track** — is construction about to start / has it started?
2. **Duration track** — how long will construction take (→ likely completion window)?

Output of this phase is a tentative algorithm ([algorithm.md](algorithm.md)). Whether it
ends up as DB columns, a worker job or UI-only interpretation is decided later.

## How to work (read this first in every session)

1. Read this README, then [findings.md](findings.md), then [algorithm.md](algorithm.md) and
   [open-questions.md](open-questions.md).
2. Every experiment: write the query to `queries/NN-name.sql` (or `scripts/`), run it,
   and log a dated entry in `findings.md` (hypothesis, query file, result, sample size,
   verdict: confirmed / rejected / unclear).
3. Update `algorithm.md` only from confirmed findings. Move new ideas into
   `open-questions.md`.
4. Read-only DB access. Follow the `.env.local` + `pg` pattern in
   [scripts/probe-projects.mjs](../../scripts/probe-projects.mjs) (port 5432, not the pooler).
5. Dates in `applications` are real `date` columns (the older migration comment about TEXT dates is stale).

## Data sources

| Object | Use |
|---|---|
| `projects_feed` view | One row per project: root application, latest application, `n_applications`, `root_state_group`, `last_updated`. Primary unit of analysis. |
| `leads` view | Application-level rows for approved (Permitted/Conditions) non-Trees apps, with `project_id`, `n_applications`, `n_dwellings`. |
| `projects`, `project_applications` | Membership + `role` (`original`/`variation`/`discharge`/`nma`/`other`), `is_root`. |
| `applications` | Full detail: `app_type`, `app_state`, `description`, `start_date`, `decided_date`, `permission_expires`, `n_dwellings`, `n_documents`, `date_validated`, `decision_issued_date`, etc. |
| `state_history` | Observed state changes (only since scraping began, so sparse). |

Schema reference: [scripts/schema-dump.txt](../../scripts/schema-dump.txt).
Grouping rules: [project-grouping-spec.md](../project-grouping-spec.md).
What each application type means legally: [planning-types-reference.md](planning-types-reference.md).
Backend issue found during analysis (roots that are discharges): [backend-issue-headless-roots.md](backend-issue-headless-roots.md).
Earlier reasoning on discharges/lanes: [web-client-kickoff/2026.09.29-next-steps-roadmap.md](../../web-client-kickoff/2026.09.29-next-steps-roadmap.md).
Backend repo docs (public): <https://github.com/simoPh83/pam/tree/main/docs>. The most relevant is
`completion-estimation-framework.md` (priors imported into [algorithm.md](algorithm.md)), plus its
three `...Reaction_*` files, `2026-10-01-planit-update-logic.md` and `2026-09-27-planit-api-findings.md`.

## Candidate signals

- **Scale:** `n_dwellings` (root and max across children), `app_size`.
- **Maturity:** `n_applications` in the project relative to scale (large scheme with 1–3 apps → early).
- **Type + state:** `app_type`/`role` combined with `app_state`. Discharge-of-conditions
  decided, s73 variations and NMAs imply the scheme is live; a bare permission implies not yet.
  Always read type together with state.
- **Text:** keywords in root and child descriptions (e.g. "demolition", "pre-commencement",
  "materials", "landscaping", "cycle store", "phase", "non-material").
- **Dates:** root `decided_date`, dates of each child, gaps between them,
  `permission_expires` (commencement deadline, typically decision + 3 years).

## Known data caveats

- Backfill window is limited; many roots predate it (parent refs resolve only ~13% of the time),
  so some projects have no root. Flag them, don't impute.
- `last_updated` was polluted by parent-hunt inserts before the 2026-10-07 fix
  ([last-activity-semantics](../2026-10-07-last-activity-semantics.md)). Prefer
  `start_date`/`decided_date` over `last_updated` as event dates.
- UPRN coverage ~4%; project clustering is address-based, so some projects are split or over-merged.
- ~20–30% of permissions are never built (roadmap assumption, unverified).

## Ground truth (the big gap)

No column says "construction started". Candidates for a validation set — see
[open-questions.md](open-questions.md): projects with discharge-of-conditions decisions,
projects the user knows on the ground, outreach outcomes, manually checked portal records.
