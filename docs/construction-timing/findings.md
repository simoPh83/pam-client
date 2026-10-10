# Findings log

Newest first. One entry per experiment.

Template:

```
## YYYY-MM-DD — short title
- **Hypothesis:**
- **Query/script:** queries/NN-name.sql
- **Sample:** n projects / n applications, filters
- **Result:**
- **Verdict:** confirmed | rejected | unclear
- **Implication for algorithm:**
```

## 2026-10-10 — Prototype `main_uid` score vs root on the 40-project sample (query 11)

- Score: type (Full 40, Outline 20, Amendment 10) + state (Permitted/Conditions 30, Undecided 20, Referred 15) + scale words 15 + description length (max 10) − 50 for junk (LDC, scoping/screening, advert/signage, tree, telecom, listed-building consent, non-material, prior approval). Ties: earliest `start_date`.
- Result: main differs from root in 25 of 40 projects (62%). Reading them, the pick is clearly the better headline in about 20: it replaces LDC / sign / EIA-scoping / porch / chimney-breast roots with the real scheme (HMO change of use, "conversion into four flats", "Partial demolition… redevelopment", "1x two-storey dwelling").
- Weaknesses seen:
  - "storey" fires on "single storey rear extension", so householder extensions get the scale bonus. Needs a narrower pattern (e.g. "\d+ ?(storey|-storey)" at 3+, flats/dwellings/units counts) and a penalty for "single storey".
  - Some type-`Outline` Permitted picks are really prior notifications ("42 days Prior Notification" wording not covered by the junk list).
  - When every member is junk or dead (e.g. a sign vs a shopfront refurbishment, score 15), the choice is arbitrary; should fall back to the root.
  - Picks among near-identical resubmissions are unimportant for headline text.
- Next: tighten the scale regex, add a minimum-score fallback to root, then re-run on a fresh seed (change `seed1`) to avoid tuning to this sample.

## 2026-10-10 — Multi-Full projects and a 40-project main-application sample (queries 09, 10)
- **Query:** [09](queries/09-multi-full-patterns.sql) (population), [10](queries/10-main-application-sample.sql) (seeded sample of 40 projects with 3–12 apps and ≥2 parent-less originals; I read the first 16).
- **Result 09:** 12,886 projects have ≥2 `Full` originals. Breakdown: two+ live permissions 5,424 (42%); one live + refused/withdrawn 2,899; one live + still open 1,874; dead + open (resubmission pending) 1,125; all refused/withdrawn 783; other 781. 90% have a single normalised address (11,556); 8,112 span <1 year, 314 span >3 years.
- **Result 10 (16 projects read):**
  - Nearly all are householder-scale sites. Multiple Fulls are **legitimate separate applications at the same address**, not mis-grouping: resubmissions after refusal, a revised scheme replacing an earlier one (HMO 4-bed → 3-bed), or independent works (extension and later HMO change of use).
  - `app_type='Outline'` is often a **lawful development certificate or prior approval** ("Certificate of lawfulness…", "Single storey rear extension 6m deep") — confirms P2 that Outline is mostly householder trivia.
  - Root is often the weakest headline: "Removal of chimney breast", "New front porch", "Erection of garden room (LDC)", "Rear dormer", while the real scheme (HMO change of use, extensions) is a later sibling. In project 87289 (99 Bishopsgate) the root is an **EIA scoping request**, while the real scheme ("ground plus 53-storey…") is the second application.
  - Genuine grouping problems seen: 2 of 16 had a mixed-bag address cluster (a shop-front Advertising grouped with a Full extension and a change-of-use LDC; a block with 4 distinct additional-storey schemes). These are different works, so one-per-address grouping hides separate "projects", but it's address-level grouping by design.
- **Verdict:** multiple Fulls per project are mostly legitimate (same site, successive/competing applications), not a grouping bug. They show why "first filed" ≠ "main".
- **Implication:** `main_uid` should favour: app_type Full over Outline (Outline≈LDC), decided Permitted/Conditions over Rejected/Withdrawn, **latest live Full** when a scheme is superseded, and larger scale words (storey, flats, dwellings, demolition, erection) over generic extensions. Avoid EIA-scoping/LDC/advert/tree/telecoms/heritage-only as main.

## 2026-10-10 — Is the root the "main" application? (query 08)
- **Backend rule (read from `pam/projects.py::refresh`):** root = first by (`role='original'` AND no parent refs) → (no parent refs) → earliest `start_date`. So the root is *not* simply the earliest filed; it is the earliest among parent-less originals. `root_in_db` = no member still has an unresolved `missing_parents` entry.
- **Result:**
  - `root_in_db=false`: 3,690 projects (≈4.4%) — the worker should repair these. Of them 1,583 discharge-, 461 variation-, 377 nma-rooted and 1,269 `original`-rooted (an original that still has a pending sibling parent).
  - `root_in_db=true` but root is discharge/variation/nma: 2,576 projects — true headless projects the worker will **not** fix (no tracked parent ref). Needs a separate decision.
  - **26,494 projects (31%) have ≥2 parent-less originals**, so the root is decided by a `start_date` tiebreak. In 6,139 of them another original Full/Outline candidate has a description >1.5× longer than the root's. In those multi-candidate projects the root is Advertising/Heritage/Amendment in ~3.7k.
- **Verdict:** the concern is justified. "Root" is a good *anchor/earliest* but not a reliable *main application*. A separate `main_uid` is warranted.

## 2026-10-10 — Root quality (backend issue)
- **Query:** [07](queries/07-root-quality.sql). Full write-up for the backend: [backend-issue-headless-roots.md](backend-issue-headless-roots.md).
- **Result:** 4,997 of 84,714 projects (≈6%) have a root whose role is discharge (3,568), variation (838) or NMA (591); `is_root = true` for every root regardless. 2,882 roots are `app_type='Conditions'` (1,496 among ≥2-app projects). 1,874 of those have a `parent_ref` (parent exists upstream, not stored); 1,008 have none. Only 123 such projects contain a Full/Outline member (true mis-grouping).
- **Correction to the 06 entry:** the problem is mostly *missing parents*, not wrong grouping.
- **Impact here:** all timing analysis must filter on root `role='original'` (and a non-Conditions `app_type`) until the backend exposes a reliable root flag.

## 2026-10-10 — n_dwellings population, zero-lag cases, filtered lag
- **Query:** [06](queries/06-dwellings-and-zero-lag.sql).
- **Result:**
  - `n_dwellings` is populated **only for `app_size` Medium (10–39) and Large (≥10, up to 6,000)**; it is 0 of ~140k for Small and for null `app_size`. So "dwellings" only exists for majors; Small projects have no scale signal beyond `n_applications` and discharge count. Coverage is also partial even within Large Full/Outline (630/1,374 and 284/374).
  - Same-day lag (≤7d) cases: 2,2xx discharge rows, of which **1,584 have a root that is itself `app_type='Conditions'`** (the discharge is rooted on another discharge, or on its sibling). The "root" is therefore often not the original permission: parent resolution failed (≈13% resolve) and the earliest-member fallback picked a discharge.
  - After requiring first discharge ≥30 days after root decision: 4,554 projects, p25 = 110 d, p75 = 490 d (median not computed; previous 120–343 d medians include zero-lag artefacts).
- **Verdict:** root quality is the main confound. Any timing rule must first restrict to projects whose root is a genuine Full/Outline/Amendment application (not `Conditions`), otherwise lags are meaningless.
- **Algorithm impact:** add precondition "root_type ∈ {Full, Outline, Amendment, Heritage?}" to S-rules; use `app_size` as the scale gate (Small/Medium/Large) with `n_dwellings` only when present.
- **Next:** repeat the lag distribution restricted to genuine roots (Full/Outline, Permitted); split by `app_size`; count how many projects are discharge-rooted (no usable root).


- **Hypothesis:** first decided discharge lags root decision; lag/volume scale with dwellings.
- **Query:** [05](queries/05-discharge-lag-by-scale.sql). Sample: projects whose root is Permitted/Conditions with a decided date and ≥1 decided-Permitted discharge on/after it (5,534 projects).
- **Result:**
  | dwellings band | projects | p25 | p50 | p75 (days) | avg discharges |
  |---|---|---|---|---|---|
  | null | 5,214 | 0 | 120 | 352 | 2.3 |
  | 10–49 | 117 | 41 | 343 | 1,023 | 3.9 |
  | 50+ | 203 | 0 | 314 | 1,463 | 8.6 |
  - **`n_dwellings` is only populated for ≥10 here** (no 1–9 bands appear at all): 94% of projects have null dwellings on the root, so scale can't be used for most projects. Probably extracted only for major schemes, to confirm.
  - Larger schemes have many more discharges (8.6 vs 2.3), a usable "scale of activity" signal.
  - Lag is very wide (p25 0 to p75 1,463 days). p25 = 0 means discharges decided same day as root (probably combined/mis-linked, or root decision being a later amendment). Medians are not a usable predictor on their own.
- **Verdict:** inconclusive for timing; supports discharge *count* as a scale/progress proxy. Lag needs conditioning (discharge count, `n_dwellings` null, same-day cases removed).
- **Next:** inspect same-day (lag ≤ 7d) cases; check how `n_dwellings` is populated; look at lag from the first *substantive* discharge (≥30 days post root).


- **Hypothesis:** P1 / H-KW: `app_type='Conditions'` is mostly discharge; discharge timing follows the root decision.
- **Query/script:** [03](queries/03-role-state-census.sql), [04](queries/04-conditions-keyword-census.sql).
- **Sample:** projects with ≥4 applications (03); all 39.7k `Conditions`-type applications (04).
- **Result:**
  - 04: ~36.7k of 39.7k `Conditions`-type rows (≈92%) match discharge keywords. Only ~0.4k look like s73 variation, ~0.2k NMA, 5 reserved matters; ~2.4k unclassified. So **P1 resolves to "Conditions = discharge of conditions"**, not s73. s73/NMA are mostly typed as something else (Amendment/Full).
  - 03 (≥4-app projects): decided-Permitted discharges are the biggest group (19.1k) with a median of **248 days from root decision to discharge start**; Undecided discharges median 448 days (still open, probably stalled/stale or late). Rejected discharges 196, Conditions-state 192. `variation` Permitted median 366, `nma` 291.
  - `original` rows have median ≈6–13 days from the root: these are the root itself and near-simultaneous siblings, not later work.
  - Reserved matters are almost invisible by keyword (5 rows); the pattern probably doesn't match council wording, so retest later.
- **Verdict:** P1 supported (Conditions = discharge). A discharge decided Permitted about 8 months after approval is the typical "work about to start/started" marker, consistent with the 8–16 week process following a ~6 month mobilisation.
- **Caveats:** `start_date` may be received date rather than a decision; gaps are medians only, no distribution yet; the 448-day Undecided median suggests stale undecided records (ties to the last_updated pollution). Root might be missing or wrong for some projects.
- **Next:** distribution (p25/p75) of discharge lag and counts of discharge decided within N days; number of discharges per project vs n_dwellings; does the first decided discharge predict anything without ground truth?

 and project size profile
- **Hypothesis:** P1 (`app_type='Conditions'` = discharge/s73) and the app_type taxonomy; population shape.
- **Query/script:** [queries/01-app-type-state-census.sql](queries/01-app-type-state-census.sql), [queries/02-project-size-profile.sql](queries/02-project-size-profile.sql), run via `node scripts/run-sql.mjs <file>`.
- **Sample:** all `applications` (~180.6k rows) and all `projects` (84,714).
- **Result:**
  - `app_type` values: Full, Conditions, Outline, Amendment, Heritage, Advertising, Telecoms, Other, Trees (1 row), null (~3.9k). No separate reserved-matters or prior-approval type, so those must be found via description.
  - `app_state` values: Permitted, Conditions, Undecided, Rejected, Withdrawn, Unresolved, Referred, null. The state `Conditions` (≈35k rows) is a different thing from the type `Conditions`.
  - Top combinations: Full/Permitted 17.6%, **Conditions/Permitted 12.7%** (22.9k), Full/Conditions 10.4%, **Outline/Permitted 9.3%** (16.8k), Full/Undecided 8.2%, Full/Rejected 6.1%, Conditions/Undecided 4.7%, Amendment/Permitted 3.2%.
  - Type `Conditions` totals ≈39.7k rows (22% of everything), matching the "39,651 discharge/amendment rows" in the grouping spec. Of these, 22.9k are decided Permitted, 8.5k Undecided (discharge pending), 2.1k Rejected, 1.2k Withdrawn.
  - Projects: 49,949 with 1 application, 18,177 with 2, 12,354 with 3–5, 2,790 with 6–10, 1,258 with 11–30, 186 with 31+. About 41% have 2+ applications. `root_uid` is non-null for every project, so it does **not** show whether a true root exists (it falls back to the earliest member).
  - Note: the 2026-10-07 doc quotes 160,156 projects, now 84,714. Not yet explained (clean-up/regrouping, or the earlier figure counted applications).
- **Verdict:** P1 partly supported (the Conditions type is large and mostly decided-Permitted, consistent with discharge decisions); description check still needed. Outline/Permitted at 9.3% is consistent with the "Outline is householder trivia" prior, unverified.
- **Implication for algorithm:** the `Conditions` type is the main post-permission indicator. Need to split it by description (discharge vs s73 vs NMA) and check `Outline` descriptions before trusting it as "early stage". Need a different test for "has a real root".

 from the backend repo (NOT measured here)
- **Source:** `simoPh83/pam` → `docs/completion-estimation-framework.md` (2026-09-29, 1,233 leads / 8 boroughs, 3-month backfill) and its Claude/Gemini/KIMI reactions.
- **Carried over as priors, to be re-tested on the full ~160k-project dataset:**
  - `app_type='Conditions'` is a **discharge-of-conditions / s73 variation**, not "permitted with conditions" (28% of the old sample). Strongest "already building / about to" signal. Phrasings: "pursuant to", "details submitted", "discharge of", "variation of condition". Detection must match all.
  - Split: C0a discharge (building under way) vs C0b s73 variation (mid-design on a live permission, not necessarily building).
  - `app_type='Outline'` is mostly householder trivia (PlanIt mapping quirk): classify from the description, not the type.
  - `app_size` is nearly useless (about 98% Small).
  - Enfield grants 5-year permissions, so `permission_expires` is not always decision + 3 years.
  - Duration table (mobilisation + build) in the framework is guesswork. Examples: householder ~6–9 months, small new-build ~15–22, demolition + rebuild ~20–36, large ~24–48.
  - Council's own `application_type` and `n_documents` were flagged as unexamined complexity proxies.
- **Verdict:** unclear (priors only). Imported into [algorithm.md](algorithm.md) as hypotheses.
