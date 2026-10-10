# Open questions and next experiments

## Next experiments (suggested order)

Done (see findings.md): population profile, app_type × state census, role census, Conditions keyword split, discharge lag by scale, root quality.

Next:
1. **Genuine-root lag:** repeat discharge lag restricted to `role='original'` roots, Full/Outline, Permitted; split by `app_size`.
2. **Backend root fix:** decide with the backend repo ([backend-issue-headless-roots.md](backend-issue-headless-roots.md)); re-run its check queries afterwards.
3. **Reserved matters:** keyword pattern found only 5 rows; inspect Outline-rooted projects' children and council wording.
4. **Keyword census (H-KW)** for discharge descriptions by lag bucket.
5. **Scale vs lifespan** for Medium/Large only (the only `n_dwellings` coverage).

(Original list kept below for reference.)

1. **Profile the population:** counts of projects by `n_applications`, `n_dwellings` band,
   `root_state_group`, and with/without a root. Establish what we are working with.
2. **app_type × app_state × role census:** which combinations occur, how often, and how
   they sit in time relative to the root decision.
3. **Timeline shapes:** for projects with 4+ applications, the typical sequence and gaps
   (root decision → first discharge → variations).
4. **Keyword census:** frequent terms in descriptions of discharge/variation children;
   which terms cluster late in the timeline.
5. **Scale vs lifespan:** for projects with an observed span (root decision → latest
   child), relate to `n_dwellings`.

## Open questions

- **PlanIt `app_type` values:** PlanIt doesn't document its taxonomy in the sources checked. Measure the distinct values
  and their description patterns from our data, and compare with the council's `application_type`.
- Reserved matters and prior approval: do they appear as distinct `app_type` values, or hide inside "Full"/"Outline"?

- Not yet read from the backend repo: Gemini reaction (27 KB), `2026.10.01-planit-update-logic.md`,
  `2026.10.05-backend-spec-new-features.md`, `audit-progress.md`, `user-log`.
- Do the framework's priors (see [algorithm.md](algorithm.md) P1–P8) hold on the full dataset?
  In particular: is `app_type='Conditions'` really a discharge, and does `application_type`
  (council's own string) classify better than `app_type`?

- **Ground truth:** what can serve as "construction started"? Options: first decided
  discharge of pre-commencement conditions; user knowledge of specific sites;
  outreach outcomes; manual portal/street-view checks of ~20–30 projects (roadmap suggestion).
- Is there any commencement/completion signal in `other_fields_json` or in
  `decision_issued_date` / `application_expires_date` that we aren't using?
- Why did the project count fall from 160,156 (2026-10-07 doc) to 84,714? Ask the backend.
- Is `n_dwellings` extraction deliberately limited to Medium/Large? Can it be derived for Small from descriptions?
- How to treat projects with no root (parent predates backfill)?
- Are NMAs/variations evidence of imminent build or just of design churn?
- Do boroughs differ enough (type labels, description style) to need per-authority rules?
