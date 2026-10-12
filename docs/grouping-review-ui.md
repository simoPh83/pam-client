# Scheme grouping and review UI

The frontend reads the scheme-level grouping model maintained by the sibling
`pam` worker. A project is one reference-connected scheme, not one physical
address; an address can therefore appear in multiple project rows.

## Data the UI reads

- `projects.grouping_state` is `clean`, `provisional`, or `ambiguous`.
  Ambiguous schemes receive a **Multiple schemes** badge and review context.
  Provisional schemes receive an **Incomplete chain** indicator.
- `project_applications.linked_by` records `reference`, `inferred`, or
  `manual` provenance. The application tabs expose that provenance in their
  hover text.
- `grouping_review` items are displayed in context:
  - `multi_root` belongs to a project and contains candidate roots.
  - `unlinked_multi_scheme` is keyed by `(authority, address_key)` and appears
    on each candidate scheme page, with a subtle count on each matching leads
    row.
  - `unlinked_no_scheme` is not a project; it appears as a grey queue row on
    the leads page while the parent is being searched.

## Supported review actions

The UI sends decisions through `apply_grouping_resolution`; it does not write
to `grouping_review` directly.

- Assign an unlinked application to a candidate scheme using that
  `project_id`.
- Keep a `multi_root` group as one scheme using `merged`.
- Dismiss an orphan using `dismiss`.

**Splitting a `multi_root` project is not supported by this RPC yet.** It is
a worker-side operation; the UI explains the limitation and must not submit a
`split` resolution to `apply_grouping_resolution`. The backend work (worker
maintaining review rows + queued split jobs) is specified in
[`2026-10-12-multi-root-split-backend-spec.md`](./2026-10-12-multi-root-split-backend-spec.md);
once it ships, this section changes: `split` becomes a valid resolution and
every ambiguous project is guaranteed a candidate list.
