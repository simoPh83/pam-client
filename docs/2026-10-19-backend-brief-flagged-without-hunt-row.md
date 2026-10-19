# Backend brief: projects flagged with missing ancestors but no hunt row

Date: 2026-10-19. Follow-up to
[2026-10-19-backend-issue-stale-flags-and-hunt-queue-gap.md](./2026-10-19-backend-issue-stale-flags-and-hunt-queue-gap.md).

## Summary

644 projects have `grouping_state = 'provisional'`, `has_missing_ancestors = true`
and **no `missing_parents` row**. The UI shows the "incomplete chain" icon but
has no hunt status to explain it. They split into two groups:

| Group | Projects | Cause |
|---|---|---|
| A | 603 | A member cites a `parent_ref` that is not in `applications`, but no `missing_parents` row was ever queued (the hunt-queue gap). |
| B | 40 | Flag is set, yet no member has an unresolved `parent_ref`. Likely a stale flag. |

The 644 figure is from a live check on 2026-10-19. Counts will drift as sync runs.

## Group A — 603 projects: enqueue the missing hunts

Each of these has at least one `project_applications.parent_ref` that matches no
application (same authority, `upper(reference) = parent_ref` or prefix
`parent_ref || '/'`), and no `missing_parents` row for it.

Requested:
1. Backfill: insert a `pending` `missing_parents` row for each such
   `(authority, parent_ref)` with `requested_by` = the citing child uid and
   `project_id` set.
2. Make `refresh()` enqueue unresolved refs so the gap cannot reopen
   (already described in the linked doc, section 2).

Acceptance: after the backfill and one hunt cycle, every project in group A has
either a `pending` or `exhausted` row, or the flag cleared because the parent
was found.

## Group B — 40 projects: re-derive the flag

All 40 have an address key but no member with an unresolved `parent_ref`, so the
flag has nothing to point at.

Requested:
1. Re-run `refresh()` (or `refresh_project_flags.py`) on these projects and
   report which flag values change.
2. If any keep `has_missing_ancestors = true` after refresh, identify what the
   flag is based on, since it is not an unresolved stored `parent_ref`. A parsed
   description ref not stored on the member row is one possibility.

Acceptance: for every project, `has_missing_ancestors = true` implies at least
one unresolved ref exists, and a `missing_parents` row exists for it.

## Related inconsistency (not part of this fix, flag for awareness)

127 projects have `root_in_db = true` but still carry a `missing_parents` row
(91 clean, 22 ambiguous, 14 provisional with `exhausted`; 4 provisional with
`pending`). If the root is in the database the row should probably be removed.
The UI currently ignores neither case, so these show a "root missing" banner
that is likely wrong.

## Check queries

Group A and B membership:

```sql
with t as (
  select p.id
  from projects p
  where p.grouping_state = 'provisional' and p.has_missing_ancestors
    and not exists (select 1 from missing_parents m where m.project_id = p.id)
)
select
  exists (
    select 1 from project_applications pa join applications a on a.uid = pa.uid
    where pa.project_id = t.id and pa.parent_ref is not null
      and not exists (select 1 from applications p2 where p2.authority = a.authority
        and (upper(p2.reference) = pa.parent_ref
             or starts_with(upper(p2.reference), pa.parent_ref || '/')))
  ) as group_a,
  count(*)
from t group by 1;
```
