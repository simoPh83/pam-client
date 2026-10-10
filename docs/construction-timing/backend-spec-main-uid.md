# Spec (draft): `main_uid` — a headline application per project

For the backend repo (`pam`). Status: draft, score prototyped on 40 projects only (see findings.md, query 11).

## Problem

`projects.root_uid` is chosen as the first parent-less original (`pam/projects.py::refresh`), ties broken by `start_date`. It is a good *anchor* for the chain but a poor *headline*:

- 31% of projects (26,494) have two or more parent-less originals, so the root is decided by a date tiebreak.
- In the sample, the root was an LDC, advert, EIA scoping request, porch or chimney-breast job while the real scheme was a later sibling (62% of sampled projects would get a different headline).
- 2,576 projects have a non-original root with `root_in_db = true`; the missing-parents worker will not repair these.

## Proposal

1. Keep `root_uid` unchanged (anchor, `root_in_db` semantics).
2. Add `projects.main_uid` (nullable, FK-like to `applications.uid`) and `projects.main_score` (int, for debugging).
3. Compute it in `refresh()` over members with `role = 'original'` (fallback: all members if none).
4. Expose `main_uid` and the main application's `description`, `app_type`, `app_state` in `leads` and `projects_feed`, with `coalesce(main, root)`.
5. The UI shows the main description as the headline.

## Scoring (v0, to be tuned)

| Component | Points |
|---|---|
| `app_type` Full / Outline / Amendment | 40 / 20 / 10 |
| `app_state` Permitted or Conditions / Undecided / Referred | 30 / 20 / 15 |
| Scale wording (3+ storey, N flats/dwellings/units, demolition and erection/redevelopment) | +15 |
| Description length | min(len, 400) / 40 |
| Junk wording (lawful development certificate, scoping/screening, advert/signage, tree, telecom, listed building consent, non-material amendment, prior approval/notification) | −50 |

Winner = highest score, ties by earliest `start_date`, then `uid`. If the winner's score is below ~30 use `root_uid`.

Known to fix before shipping: "single storey" must not score as scale; add "prior notification" to junk.

## Open decisions

- Should a refused scheme with a later live resubmission lose to the resubmission (current score does this through state)?
- Recompute on every refresh, or only when membership changes?
- Where multi-scheme addresses (four separate extensions on one block) should be split: out of scope here.

## Validation plan

- Re-run on a fresh seed and ~100 projects, hand-scored good/neutral/bad.
- Measure how often main = root after the missing-parent worker has caught up.
- Query: `queries/11-main-score-prototype.sql` (change the seed).
