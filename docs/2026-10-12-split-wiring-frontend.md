# Frontend wiring: multi-root split + maintained review rows

**Date:** 2026-10-12 · **Backend:** `simoPh83/pam` — implemented, pending
deploy (`scripts/apply_grouping_rpc.py --apply`, then the two backfill
scripts, then worker restart). **Spec:**
[`2026-10-12-multi-root-split-backend-spec.md`](./2026-10-12-multi-root-split-backend-spec.md)
(canonical copy now also in the `pam` repo, with implementation notes).
**Supersedes:** the "splitting is not supported" note in
[`grouping-review-ui.md`](./grouping-review-ui.md).

## What the backend now guarantees

1. Every `grouping_state='ambiguous'` project has **exactly one pending
   `multi_root` review row** with a fresh `candidates` list
   (`[{uid, description, app_type, start_date}]`, one per member with no
   resolved parent ref). The worker maintains this on every regroup —
   candidates refresh in place, and the row auto-resolves (`obsolete`) if
   the project leaves `ambiguous` on its own (e.g. a parent-hunt links the
   roots).
2. `apply_grouping_resolution` accepts `'split'` for `multi_root` rows.

## Wiring the split action

Multi-root banner gains **"Split into separate schemes"** alongside the
existing "keep merged":

```ts
const { data, error } = await supabase.rpc('apply_grouping_resolution', {
  p_review_id: review.id,
  p_resolution: 'split',
});
// data = { action: 'split_queued', project_id }
```

Possible errors to surface as toast messages (all raised by the RPC):

| Error | Meaning / UI hint |
|---|---|
| `review row N is not pending` | already resolved — just refetch |
| `project N is no longer ambiguous` | stale review (parent-hunt fixed it) — refetch; the banner should disappear |
| `project N no longer exists` | cascade-deleted — refetch |

Do **not** handle `split` like `merged`: the review row deliberately **stays
pending** until the worker finishes, so a failed split can't lose it.

## In-flight state

On `split_queued`, show *"Split requested — the worker will separate these
schemes shortly"* and read `split_requests` (select granted to
authenticated; one row per project):

```ts
supabase.from('split_requests').select('status, error')
  .eq('project_id', projectId).maybeSingle();
```

| `status` | UI |
|---|---|
| `pending` / `running` | spinner state; worker picks it up within ~1 min when idle (30 s poll, priority 100 jumps ahead of backfills/syncs) |
| `failed` | show `error`, offer retry — retrying is just calling the RPC again (the upsert re-arms the row) |
| row gone | done — refetch; the review row is now `resolved`/`split` |

Repeat clicks are free: one request per project (PK), one queued job
(`dedupe_key`); the RPC is idempotent while a request is in flight.

## After the split

- The component containing the project's old `root_uid` **keeps the existing
  `project_id`** — the page the user was on stays valid. Every other
  component is a brand-new project (own feed row, own lead pages).
- Each resulting project is re-derived independently: a component that still
  has 2+ roots of its own lands back in `ambiguous` with a **fresh** review
  row (rare; e.g. a reference cycle).
- `unlinked_*` orphans keyed by `(authority, address_key)` resurface on each
  resulting project automatically — no extra work.
- UI-owned data (`ui_project_stars`, `ui_project_meta`,
  `ui_project_practices`, `ui_project_agent_presence`, `ui_project_root_tsv`)
  **stays on the retained project id** — documented trade-off, the backend
  can't know which scheme the user cared about.

## Cleanup once deployed

- Remove the stopgap that derives multi-root candidates from
  `project_applications` (`has_parent_refs = false`) — the review row's
  `candidates` is always present and fresher. (Note: backend candidates are
  members with no *resolved* parent ref, a slightly wider and more correct
  set than the stopgap's.)
- Remove the *"This address contains multiple candidate schemes. Review
  details are not currently available."* fallback — ambiguous projects
  always have a candidate list after the backfill runs.
- The `unlinked_no_scheme` queue shrinks a little (6 standalone mains
  promoted), and future parent-ref parsing catches `Ref:`/`RN:` citations —
  no frontend change needed for either.
