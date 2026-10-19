# Backend issue: stale chain flags + hunt-queue gaps (Haringey HGY/2024/0141)

Date: 2026-10-19 · Raised from: pam-client · Owner: PAM backend (`simoPh83/pam`)
Follow-up to: `docs/2026-10-14-backend-issue-root-in-db-vs-grouping-state.md`

## Symptom
Haringey `HGY/2024/0141` shows in the projects table as a complete scheme
(root + children icon, no "Incomplete chain" signals beyond the "Multiple
schemes" label), but its description — and those of at least 17 of the 41
members — cite `HGY/2022/1833` (permission dated 10 July 2023), which is not
in `applications`. `missing_parents` has **no row** for it even though the
Haringey parent hunt has run to completion.

## Case investigated: Haringey / HGY/2024/0141 (project id 109185)

`projects` row: `root_uid = Haringey/HGY/2024/0141`, `n_applications = 41`,
`grouping_state = 'ambiguous'`, `root_in_db = true`, `has_missing_ancestors = false`.
`grouping_review`: one pending `multi_root` row (2026-10-12, empty candidates).

- Root member `HGY/2024/0141`: app_type `Conditions`, role `discharge`,
  `parent_ref = 'HGY/2022/1833'`. Description: *"Approval of details (Phase 1A
  only) pursuant to Conditions 29 (Overheating) attached to Planning Permission
  Ref: HGY/2022/1833 dated 10 July 2023."*
- 16+ other members (`2025/…` CND/NMA) also cite `HGY/2022/1833`.
- `HGY/2022/1833` is absent from `applications`; the backend's own resolution
  rule (`upper(reference) = ref OR starts_with(upper(reference), ref || '/')`)
  returns 0 rows.
- `missing_parents`: no row for `(Haringey, HGY/2022/1833)`.
- Applications were first seen 2026-10-03; descriptions unchanged since ingest.

## Diagnosis (two distinct problems)

### 1. Stale flags — the row predates the flag fix
Dry-running the current `refresh()` on project 109185 (rolled back, no writes)
produces the correct values:

```
before: root_uid=Haringey/HGY/2024/0141, ambiguous, has_missing_ancestors=false, root_in_db=true
after : root_uid=Haringey/HGY/2024/0141, ambiguous, has_missing_ancestors=true,  root_in_db=false
```

So the fixed code is correct; this project's stored flags were simply never
re-derived by it. Odd, because `refresh_project_flags.py` evidently ran
(`has_missing_ancestors` has no NULLs globally, and spot-checked `ambiguous`
projects, e.g. Barnet 8685/8756/8904/9039/9082, match a fresh re-derivation).
Its filter (`root_in_db IS DISTINCT FROM true OR grouping_state <> 'clean'`)
should have included 109185 (`ambiguous`). Worth checking the script's run log
for skipped/failed batches.

### 2. Hunt-queue gap — `refresh()` never enqueues `missing_parents`
`missing_parents` rows are only inserted by `group()` (pass 4b), i.e. when an
application's membership is recomputed. These applications were grouped on
2026-10-03/04; the parser learned to extract this ref shape around 2026-10-12
(`pam/projects.py` `parent_refs_of`). Nothing re-ran `group()` for them after
the parser change, and `refresh()` — used by sync and by the flags script —
re-parses descriptions for the flags but does **not** enqueue unresolved refs.
Result: the Haringey hunt completed without ever seeing `HGY/2022/1833`, and
the project cannot heal itself.

**Scale:** 768 unresolved stored `parent_ref`s across **726 projects** have no
`missing_parents` row (first parsed ref per member only — the true count
including secondary parsed refs is higher):

```sql
with unresolved as (
  select distinct pa.project_id, a.authority, pa.parent_ref
  from project_applications pa
  join applications a on a.uid = pa.uid
  where pa.parent_ref is not null
    and not exists (
      select 1 from applications p
      where p.authority = a.authority
        and (upper(p.reference) = pa.parent_ref
             or starts_with(upper(p.reference), pa.parent_ref || '/')))
)
select count(*) filter (where mp.reference is null) as refs_without_queue_row,
       count(distinct u.project_id) filter (where mp.reference is null)
from unresolved u
left join missing_parents mp
  on mp.authority = u.authority and mp.reference = u.parent_ref;
```

## Requested backend changes

1. **Fix this project now**: targeted `refresh(conn, [109185])`, or re-run
   `scripts/refresh_project_flags.py` and investigate why 109185 was skipped.
2. **Close the queue gap**: make `refresh()` (or a one-off backfill script)
   `INSERT INTO missing_parents … ON CONFLICT (authority, reference) DO NOTHING`
   for refs that parse but don't resolve — same source list as
   `_set_root_and_state()`'s live resolution. For this case:
   `('Haringey', 'HGY/2022/1833', 2022, 'Haringey/HGY/2024/0141', 109185)`.
3. **Optional, longer term**: when the parser changes, consider a re-`group()`
   pass over applications whose stored `parent_ref` differs from a fresh
   `parent_refs_of(description)`, so queue and flags stay aligned after parser
   updates.

## Client impact
None. Once the backend re-derives the flags, the UI shows the amber
"Incomplete chain" icon (driven by `has_missing_ancestors`) for this project;
the parent-hunt tooltip will read "earlier application predates our records —
being fetched" once the queue row exists.
