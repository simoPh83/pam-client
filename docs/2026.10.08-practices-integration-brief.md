# Practices integration brief

**Date:** 2026-10-08  
**Status:** Initial product and frontend draft, updated with the
agent-promotion addition (see section 8)  
**Related spec:** [`web-client-kickoff/04-frontend-spec-new-features.md`](../web-client-kickoff/04-frontend-spec-new-features.md)

## 1. Brief

Allow users to maintain a shared register of architectural, landscape,
planning, and other practices, then assign one or more practices to a project.
The assignment and practice details are global: all authenticated users see
the same information and can contribute to it.

The first version should support:

- A practice name and website URL.
- A free-text role for the practice on a project, such as “main architect”,
  “landscape architect”, or “planning consultant”.
- Optional notes about the practice or its project involvement.
- Multiple contacts for each practice.
- Contact name, email address, phone number, and role.
- Searching and reusing existing practices and contacts.
- Adding a new practice or contact without leaving the project page.
- Surfacing the PlanIt agents of all a project's applications at project
  level (read-only), so a user can verify and promote one into a shared
  practice record.
- A projects-list indicator showing whether a project has no agent data, a
  PlanIt agent, or a verified practice assigned — also usable as a filter.

Practices are editable and removable by every authenticated user; there is no
user hierarchy or ownership on these records.

This is an extension of the existing practice register and project-linking
direction in section 5 of the frontend feature spec. It should not duplicate
the practice data per project: the practice and its contacts are shared
records, while the project link carries the project-specific role and notes.

## 2. Project page experience

The project page should be divided into two kinds of content.

### Persistent project context

This remains visible while the user changes application tabs:

- Project name, address, authority, and project-level actions.
- Assigned practices, including each practice’s role on the project.
- Practice contacts, available by expanding a practice or opening its details.
- A read-only **PlanIt agents** block aggregating the agent name/company and
  agent address returned by PlanIt across **all** applications in the project,
  clearly labelled as unverified application data (see section 9).
- Outreach section and its project-level state.
- Other project-level indicators such as stars or alerts, where applicable.

The per-application agent and agent address values still come from PlanIt and
remain in the application-specific area as well. The project-level block is an
aggregated, read-only view over them — it is not stored project metadata and
must not be editable.

### Application-specific content

Clicking an application tab refreshes only the application-specific area:

- Application status, dates, role, and source details.
- PlanIt agent and agent address for the selected application.
- Any other fields that differ between applications.

The persistent project context must not disappear or reset when the selected
application changes. This avoids losing the practice and outreach context
while reviewing several applications belonging to the same project.

## 3. Assign practice flow

Add an **Assign practice** action to the project-level area of the project
page. It opens a modal or pop-up over the current page; it must not navigate
to a separate page.

The modal should support:

1. Searching existing practices by name.
2. Selecting an existing practice and assigning it to the project.
3. Entering the practice’s project role and optional link note.
4. Creating a new practice inline when no suitable result exists.
5. Reviewing or selecting contacts belonging to the practice.
6. Adding a new contact inline when the required person is not yet recorded.
7. Saving the assignment without losing the current project or application tab.

The search should make it clear when a result is an existing shared record.
Creation should guard against duplicate practice names, including
case-insensitive matches, and should offer the existing record if a conflict
occurs.

After saving, the project page should show the new assignment immediately and
all users should be able to see it after the normal data refresh. The modal
should report save and validation errors explicitly rather than silently
falling back to an unsaved state.

## 4. Proposed shared data model

The existing draft model is a good starting point:

- `practices`: shared practice records with `name`, `website`, and general
  `notes`.
- `project_practices`: the shared project-to-practice assignment, with
  `project_id`, `practice_id`, and project-specific `notes`.

Refine `project_practices` to include a free-text `role` field. A controlled
vocabulary is not required for v1; examples can be offered as placeholder
text or suggestions without preventing other roles.

Add a shared contacts table:

- `practice_contacts`: `id`, `practice_id`, `name`, `email`, `phone`, `role`,
  and optional `notes` if the product needs contact-specific context.

Recommended rules:

- Practices and contacts are visible to all authenticated users.
- `practice_contacts.practice_id` is required and uses cascading deletion only
  if the product permits deleting a practice; otherwise deletion should be
  blocked while assignments or contacts exist.
- A practice may have zero, one, or many contacts.
- A contact can be assigned to only one practice in v1.
- Email and phone are optional because public records may be incomplete.
- Practice name is required and unique case-insensitively.
- Contact name is required; duplicate contacts should be allowed unless a
  later data-quality rule proves safe.
- `created_by` may be retained for attribution, but it must not make the
  records private.

The exact column types, indexes, and RLS policies should follow the live
Supabase schema and the migration conventions already described in the
frontend feature spec.

The aggregated PlanIt agents block (section 8) is deliberately **not** part of
this model: it is computed from `project_applications` → `applications` at
read time (a view or query), so there is no duplicated agent data to
maintain.

At the time of writing the live database has **no** practice or contact
tables yet; this schema is greenfield. For scale context: ~75k of ~179k
applications carry PlanIt agent data, covering ~33k of ~85k projects.

## 5. Register and detail views

The practice register should provide:

- Search by practice name.
- Practice website and general notes.
- Number or list of linked projects.
- Number or list of contacts.
- Actions to edit the practice and manage contacts.
- A delete action, available to all users; deletion is blocked while the
  practice still has project assignments (contacts may cascade or must be
  removed first — see open decision 3’s resolution below).

The project page should provide a compact view of assigned practices, with:

- Practice name linking to its shared details.
- Website link.
- Project role.
- Project-specific note.
- A contact summary and an action to view/select contacts.
- Unassign action, with confirmation where existing outreach context could be
  affected.

Editing a practice’s shared name, website, or contacts should update the
shared register and the project page consistently. Editing the role or note
from a project must change only that project assignment.

## 6. Access and consistency expectations

These records are deliberately global, unlike private outreach logs. The UI
should label them as shared and avoid wording that implies ownership by the
current user.

The project page should use project-level queries for practices and outreach,
and application-level queries for the selected tab. Changing tabs should not
re-fetch or overwrite the shared practice assignment unless a mutation or
explicit project refresh occurred.

Concurrent edits are possible because all users can write shared data. The
client should handle duplicate-name conflicts and stale updates with an
explicit error or refresh prompt, not a success-shaped response.

## 7. Initial acceptance criteria

- A user can assign more than one practice to a project.
- Each assignment displays a free-text project role and optional note.
- A practice can have multiple contacts with name, email, phone, and role.
- Existing practices and contacts can be searched and reused.
- New practices and contacts can be created from the project-page modal.
- The modal does not navigate away from the project page.
- Project-level practices and outreach remain visible when application tabs
  change.
- The selected application’s PlanIt agent and agent address update with the
  selected application and do not overwrite project-level data.
- Shared records are visible to other authenticated users.
- Any authenticated user can edit or delete a practice; deletion is blocked
  while assignments exist.
- Validation, duplicate conflicts, and save failures are shown explicitly.
- The project page shows a read-only, clearly labelled block aggregating the
  PlanIt agents of all the project’s applications, deduplicated.
- The projects list shows the three-state practice indicator (none / agent
  present / practice assigned) and can be filtered by it; “practice assigned”
  takes precedence over “agent present”.

## 8. PlanIt agent promotion and projects-list indicator

### Aggregated PlanIt agents at project level

PlanIt returns an agent (name/company and address) per application. To help
users spot the architectural practice behind a project, the project page
collects the agent values of **all** applications in the project into a
single read-only block in the persistent project context.

- This is derived data — a query (or database view) over
  `project_applications` joined to `applications`, **not** a new stored
  field. There is nothing to keep in sync and it stays correct as the
  fetcher updates applications.
- Entries should be deduplicated by normalised company/person name, and the
  block must be visibly marked as read-only “application data”, distinct
  from verified practices.
- Known data-quality caveats to handle at display time: stray leading quotes
  in some `agent_company` values (e.g. `'Atermon Architecture`) and `?`
  placeholders.

### Verification workflow

The PlanIt agent is a hint, not a fact. The intended flow:

1. The user reviews the aggregated agents block on the project page.
2. They verify the agent against the actual application documents (the
   council/PlanIt links already on the page).
3. If confirmed, they add the practice through the assign-practice modal
   (section 3), creating the shared record if it does not exist yet.

There is no automatic conversion: a project only counts as “practice
assigned” once a user has made the assignment.

### Projects-list indicator and filter

The projects list (homepage) gains an icon column with three mutually
exclusive states, highest precedence last:

1. **No practice signal** — no PlanIt agent on any application and no
   practice assigned.
2. **Agent present** — at least one application in the project has PlanIt
   agent data, but no practice is assigned yet.
3. **Practice assigned** — at least one verified practice is assigned;
   overrides “agent present”.

The same three states are available as a filter criterion on the projects
list, so users can e.g. work through “agent present but unverified”
projects. The flags belong in `projects_feed` (or an equivalent feed-level
source) so list pages stay single-query.

**Implementation note (2026-10-08):** probing `project_applications` →
`applications` per candidate row made the filtered exact count exceed the
8s statement timeout, so “agent present” is maintained as a
trigger-updated cache table (`ui_project_agent_presence`, migration 005)
which `projects_feed.practice_status` probes by primary key. Filtered
counts dropped from >8s to under 200ms.

## 9. Open decisions for implementation

1. Should a project assignment select one or more contacts, or should all
   contacts for the practice simply be available from the assignment?
2. Should contacts have their own detail/edit modal, or can v1 manage them
   entirely inside the assign-practice modal?
3. ~~Should a practice be removable from the register, or only unassigned
   from projects?~~ **Resolved:** practices are removable by all users; there
   is no user hierarchy. Deletion is blocked while assignments exist.
4. Should the role remain free text permanently, or should common roles become
   suggestions after real usage data is available?
5. Should the project page use a side panel, centred modal, or responsive
   dialog for the assignment flow?

These decisions do not block the initial information architecture or schema
spike, but they should be resolved before implementation of the final
interaction details.
