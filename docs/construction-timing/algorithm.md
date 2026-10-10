# Draft algorithm

**Version:** v0 (untested hypotheses only — nothing here is confirmed yet)
Update only from confirmed entries in [findings.md](findings.md); cite the entry date for each rule.

## Output (proposed)

Per project:
- `start_stage`: `not_started` | `imminent` | `likely_started` | `underway` | `unknown`
- `start_window`: estimated date range
- `duration_months`: range, driven mainly by scale
- `confidence`: low | medium | high

## Start track (hypotheses)

| # | Rule | Evidence |
|---|---|---|
| S1 | Root decided + any discharge-of-conditions application decided → construction likely started or imminent | untested |
| S2 | s73 variation / NMA filed after the root permission → scheme is live (post-permission design development) | untested |
| S3 | Large scheme (high `n_dwellings`) with very few applications → early stage | untested |
| S4 | Permission age vs `permission_expires`: close to expiry with no discharge → either about to start or dead | untested |
| S5 | Outline root with no reserved-matters child → very early; reserved matters filed/decided → moving towards start. See [planning-types-reference.md](planning-types-reference.md) | untested |
| S6 | Discharge *filed* is earlier evidence than discharge *decided*; use both dates | untested |
| H-KW | Discharge descriptions naming pre-commencement matters (demolition, construction management, contamination, drainage) mean "about to start"; naming late matters (materials, landscaping, cycle store, finishes) mean "building" | untested |

## Duration track (hypotheses)

| # | Rule | Evidence |
|---|---|---|
| D1 | Duration grows with `n_dwellings` (banded) | untested |
| D2 | Discharge date minus root decision date approximates the lead time to start | untested |

## Confirmed so far (from findings.md, 2026-10-10)

- **P1 confirmed:** `app_type='Conditions'` is ~92% discharge of conditions; s73/NMA are rarely typed this way.
- **Scale gate:** `n_dwellings` exists only for `app_size` Medium/Large (and partly); Small and null-size have none. Use `n_applications` and discharge count as fallback scale (8.6 avg decided discharges at 50+ dwellings vs 2.3 where null).
- **Precondition for every timing rule:** root must have `role='original'` and `app_type` ≠ Conditions; ~6% of projects fail this (see [backend-issue-headless-roots.md](backend-issue-headless-roots.md)).
- **Discharge lag is not yet usable:** unfiltered medians 120–343 d are contaminated by bad roots; after ≥30 d filter p25=110, p75=490 (4,554 projects).

## Priors from the backend framework (not validated at full scale)

Source: `pam/docs/completion-estimation-framework.md`; see the 2026-10-10 entry in [findings.md](findings.md).

| # | Prior |
|---|---|
| P1 | `app_type='Conditions'` = discharge/s73 on an approved scheme (not a permission state). C0a discharge → building under way or imminent; C0b s73 variation → live permission, still in design. |
| P2 | Classify by description keywords, most specific first: demolition + erection → new-build → commercial → conversion → large householder → householder. Do not trust `app_type='Outline'` or `app_size`. |
| P3 | Lag decision → site start by category: householder 2–4 months, new-build 4–8, demolition + rebuild 6–12, commercial/large 6–12. |
| P4 | Build duration by category: householder 3–5 months, large householder 6–9, conversion 6–10, small new-build 9–14, demolition + rebuild 14–24, commercial 12–30, large 18–36. |
| P5 | Discharge detail submissions occur roughly 0–6 months before the relevant build phase; remaining build after a discharge ≈ 6–12 months (small works) or 12–24 (redevelopment). |
| P6 | `permission_expires` caps the latest start. Check per authority (Enfield uses 5 years). |
| P7 | Median decision time for Undecided rows ≈ 50 days. |
| P8 | Outreach should happen at the start of the estimated window. |

These replace nothing in S1–D2. They give the first-pass numbers to measure against.
