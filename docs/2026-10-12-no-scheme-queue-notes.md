# Backend note: `unlinked_no_scheme` queue — standalone mains + parser gaps

**Date:** 2026-10-12 · **For:** `simoPh83/pam` (worker + schema)
**Related:** `2026-10-12-multi-root-split-backend-spec.md` (same repo, docs).
Short companion note, not a full spec — two worker-side issues found while
reviewing the queue from pam-client.

## Context (measured 2026-10-12)

The `unlinked_no_scheme` queue is **742 pending rows** (down from 2,094 at
migration — the parent-hunt is absorbing them steadily). App-type breakdown:

| app_type | rows |
|---|---:|
| Conditions | 475 |
| Full | 120 |
| Amendment | 107 |
| (null) | 14 |
| Outline | 14 |
| Heritage / Other | 12 |

Only **30 distinct cited parent refs** exist across the queue (strict
regex), and **none resolve** to a stored application — so the queue is
genuinely "parents we don't hold yet", not a local linking failure.

## Issue 1 — genuine standalone mains sit in the queue

Per the scheme-grouping model, a parent-less **original** application is a
legitimate root: it should become its own clean project, never an
`unlinked_no_scheme` row. Yet the queue contains clear standalone mains,
e.g.:

- `Bromley/26/03662/HPA` — "Single storey rear infill extension,
  installation of air condition unit…"
- `Brent/26/2322` — "Installation of a new mechanical extraction and
  ventilation system…"
- `Barnet/26/3230/FUL` — "Installation of a kitchen extract ventilation
  system within existing commercial unit…"

No parent ref, no discharge/variation/NMA keywords, no scheme at the
address. Expected: standalone clean project. Observed: queue row. Either
these predate the current grouping logic (migration/orphans_to_review
leftovers the worker never revisits) or `group()` queues no-ref
applications at scheme-less addresses regardless of classified role.

**Ask:** in `pam/projects.py::group()`, when a no-ref application at a
scheme-less address classifies as `original`, create a standalone project
(root = itself) instead of an `unlinked_no_scheme` review row. Also sweep
existing queue rows: any whose description classifies as `original` should
be promoted to a project and the review row auto-resolved (`obsolete`).

Caveat: PlanIt's `app_type` is the *form*, not the scheme role — most
`Full`/`Outline` rows in the queue are actually s73 variations, reserved
matters, or details records, so classification must stay
description-keyword based, not app_type based.

## Issue 2 — parent-ref parser misses common citing formats

Queue rows (and possibly grouped members) cite parents in formats the
strict regex
(`(?:permission|application|consent)\s*(?:ref…)?`) doesn't match:

- `Enfield/26/03528/RM` — "reserved matters approved under **Ref:**
  23/02239/OUT"
- Westminster s73s — "planning permission dated 16th June 2025 **(RN
  24/05892/FULL)**", "(RN: 25/03133/FULL)"
- `Wandsworth/2026/2752` — "planning permission dated 22/05/2025 **ref
  2025/1231**"

**Ask:** extend the parser with bare `Ref:` / `RN` / `RN:` prefixes
(still requiring a digit and min length, as now). Each fix lets `group()`
link the child to an already-stored parent with no API call — cheap wins,
same "resolved_locally" path the parent-hunt uses. Given only ~30 cited
refs exist in the current queue, impact today is small, but the same
patterns appear in grouped memberships and would improve future ingestion.

## Validation

- After the sweep: `unlinked_no_scheme` pending count drops by the number
  of `original`-classified rows; each promoted row leaves a clean
  single-application project.
- Parser change: re-run the existing ref-resolution probe and confirm the
  sample uids above link to their parents; no regression on the strict
  regex's false-positive guards.
