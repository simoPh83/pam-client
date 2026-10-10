# Backend issue: projects whose "root" is a discharge/variation, not the original permission

**Date:** 2026-10-10 · **Found by:** construction-timing research (client repo) · **For:** backend repo (`simoPh83/pam`) grouping / parent-hunt logic

## Summary

Roughly **6% of projects (4,997 of 84,714) have a `root_uid` that is not an original application**: it is a discharge-of-conditions, s73 variation or NMA. `project_applications.is_root` is `true` for these rows regardless of `role`, so the flag cannot tell consumers whether a real root exists.

In most cases this looks like a **missing parent** (the true permission is not in our DB, so the earliest available child gets promoted), rather than wrong grouping. Only a minority (123 projects) also contain a Full/Outline sibling that would be a better root.

Why it matters: any analysis keyed on "root decision date" (construction timing, permission age, expiry, lag to discharge) is wrong for these projects. Example: the first discharge shows a ~0-day lag from a "root" that is itself a discharge.

## Evidence (all from [queries/07-root-quality.sql](./queries/07-root-quality.sql), read-only, run 2026-10-10)

| Probe | Result |
|---|---|
| Root `app_type`, all 84,714 projects | Full 52,418 · Outline 17,076 · Amendment 3,322 · Advertising 3,159 · **Conditions 2,882** · Heritage 2,843 · null 2,141 · Telecoms 626 · Other 246 |
| Same, projects with ≥2 apps (≈35k) | Full 20,547 · Outline 7,702 · Heritage 1,693 · **Conditions 1,496** · Amendment 1,227 · Advertising 1,170 |
| Root `role` in `project_applications` (all have `is_root = true`) | original 79,717 · **discharge 3,568 · variation 838 · nma 591** |
| Conditions-type roots with `parent_ref` set | 1,874 with a ref (parent named but not resolved/stored) · 1,008 with no ref at all |
| Projects with Conditions-type root that also contain a Full/Outline member | **123** |

Also from [06](./queries/06-dwellings-and-zero-lag.sql): of discharges decided within 7 days of the "root" decision, 1,584 sit in projects whose root is Conditions-type.

## Interpretation

1. **Headless projects (most cases).** 1,874 Conditions roots do carry a `parent_ref`, i.e. the parent exists on the council side but we never fetched/linked it (consistent with the ~13% parent resolution rate and the backfill window). The fallback `root_uid = earliest member` then selects the discharge.
2. **No parent_ref at all (1,008).** Discharge applications lacking a parent reference; may need address/description-based linking, or a different fetch path.
3. **Mis-grouping (small, 123 projects).** A Full/Outline member exists in the same project but is not the root. Probably date ordering (a variation or later Full filed earlier than the matched one, or `start_date` ties/nulls).

## Suggested backend changes (for discussion)

- Set `is_root` (and/or add `root_resolved boolean`) true **only when the root's role = `original`** (or the parent was actually resolved). Keep a fallback pointer separately, e.g. `anchor_uid`, so UIs and analysis know "earliest available" ≠ "real parent".
- Prefer a Full/Outline/Amendment/Heritage member over Conditions/variation/NMA when choosing the fallback root, even if later by date.
- Parent hunt: prioritise the 1,874 projects whose root has a `parent_ref` but whose parent is not in `applications` (cheap, targeted fetches).
- Expose the status in `leads` / `projects_feed` (e.g. `root_type` / `root_resolved`) so the client can show "original permission not found".

## Check queries to re-run after a fix

```sql
-- headless count: roots that are not original
select pa.role, count(*)
from projects p
join project_applications pa on pa.project_id = p.id and pa.uid = p.root_uid
group by 1 order by 2 desc;

-- fixable mis-groupings: non-original root but an original-type member exists
select count(distinct p.id)
from projects p
join project_applications rpa on rpa.project_id = p.id and rpa.uid = p.root_uid and rpa.role <> 'original'
join project_applications o on o.project_id = p.id and o.role = 'original';

-- parent named but absent from applications
select count(*)
from projects p
join project_applications pa on pa.project_id = p.id and pa.uid = p.root_uid
where pa.parent_ref is not null and pa.role <> 'original';
```

## Caveats

- `n_applications` 1-app projects are almost all legitimate originals; the issue is concentrated in multi-app projects (1,496 of ≈35k, ~4%, are Conditions-rooted).
- `role` values come from the backend's own classification; I have not audited that classifier.
- Not checked: per-authority variation, whether `parent_ref` strings are resolvable by simple normalisation, why the project count fell from 160,156 (2026-10-07 doc) to 84,714.
