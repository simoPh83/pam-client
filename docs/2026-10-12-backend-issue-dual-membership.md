# Backend issue: dual project memberships break the one-project-per-app invariant

**Date:** 2026-10-12 · **For:** `simoPh83/pam` (worker + schema)
**Found from:** pam-client — clicking a merged application's tab rendered it
as a standalone page (membership lookup ambiguous).

## Symptom

`Croydon/26/01368/FUL` is a member of **two** projects:

| project_id | n_applications | is_root | linked_by | created_at |
|---|---:|---|---|---|
| 88733 | 4 | false | reference | 2026-10-04 |
| 650582 | 1 (singleton, itself the root) | true | reference | 2026-10-10 (migration) |

The scheme model requires *every application is a member of exactly one
project* (verified at migration time), and the frontend relies on it.

## Scale (measured 2026-10-12)

```sql
select count(*) from (
  select uid from project_applications group by uid having count(*) > 1
) t;
-- 2,249 uids
```

Shape: 2,242 uids in exactly 2 projects (7 in 3+); 2,233 involve a
singleton project; **none of the involved projects were created on
2026-10-12** — this predates the split deploy and is not caused by it.
Duplicate rows are almost all `linked_by='reference'` (4,505 rows; only 2
`inferred`).

## Likely mechanism

At migration, `26/01368` was its own component → singleton project 650582.
Later, incremental `group()` resolved a reference edge connecting it to the
25/00586 chain and inserted a membership in 88733 **without removing the
existing membership** in 650582. The PK is `(project_id, uid)`, so
`ON CONFLICT DO NOTHING`-style upserts can't detect that the uid already
belongs elsewhere. `projects` aggregates (n_applications, root_uid) and any
per-project review rows then disagree with reality — 88733's
`multi_root` review listed 26/01368 as a candidate root while the worker
still considered it the root of 650582.

## Asks

1. **Repair script**: find dual memberships; keep the membership whose
   project contains the uid's *resolved reference neighbourhood* (or simply
   the non-singleton project when the other is a singleton whose root is the
   uid itself), delete the loser, re-derive the affected projects
   (`refresh()` + `_set_root_and_state()`), and retire now-empty projects
   (re-point `ui_*` rows / `missing_parents` / `project_aliases` as the
   migration did). 2,233 of 2,249 look like the easy singleton case.
2. **Enforce the invariant**: `create unique index on project_applications
   (uid);` — the schema should make dual membership impossible.
3. **Fix `group()`** in `pam/projects.py`: before inserting a membership,
   delete (or move) any existing `project_applications` rows for the uid in
   other projects, and re-derive the abandoned project (it may become empty
   → retire, or lose its root → re-run `_set_root_and_state`).

## Frontend mitigation (shipped in pam-client)

`getLeadDetail()` no longer uses `maybeSingle()` for the membership lookup
(which errored silently on duplicates → project context lost). It fetches up
to 5 rows and picks the project with the most members (ties → lowest id).
Remove the workaround once the unique index lands.

## Validation

```sql
-- must return 0 after repair
select count(*) from (
  select uid from project_applications group by uid having count(*) > 1
) t;
-- no empty projects left behind
select count(*) from projects p
where not exists (select 1 from project_applications pa
                  where pa.project_id = p.id);
```
