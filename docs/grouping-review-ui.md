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
- Split a `multi_root` group into separate schemes using `split`.
- Dismiss an orphan using `dismiss`.

**Split is asynchronous** (backend deployed 2026-10-12): the RPC returns
`{action: 'split_queued'}` and leaves the review row pending; the worker
performs the split (usually within a minute) and only then marks the review
`resolved`/`split`. In-flight state is read from `split_requests`
(`pending`/`running`/`failed`); repeat clicks are idempotent. See
[`2026-10-12-split-wiring-frontend.md`](./2026-10-12-split-wiring-frontend.md)
for the wiring contract and
[`2026-10-12-multi-root-split-backend-spec.md`](./2026-10-12-multi-root-split-backend-spec.md)
for the backend spec.
