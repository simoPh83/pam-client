// Row shapes matching the live Supabase schema (see scripts/dump-schema.mjs output).
// Date columns are Postgres `date` → returned by supabase-js as "YYYY-MM-DD" strings.
// Timestamps are timestamptz → ISO strings.

export type Lead = {
  uid: string;
  reference: string | null;
  authority: string | null;
  address: string | null;
  postcode: string | null;
  description: string | null;
  app_type: string | null;
  app_size: string | null;
  app_state: string | null;
  decided_date: string | null;
  agent_display: string | null;
  agent_name: string | null;
  agent_company: string | null;
  agent_address: string | null;
  applicant_name: string | null;
  lat: number | null;
  lng: number | null;
  n_dwellings: number | null;
  first_seen: string;
  last_updated: string;
  project_id: number | null;
  n_applications: number | null;
};

export type Project = {
  id: number;
  authority: string;
  name: string | null;
  address_key: string;
  root_uid: string | null;
  latest_uid: string | null;
  n_applications: number;
  first_seen: string | null;
  last_updated: string | null;
};

export type ProjectMembership = {
  project_id: number;
  uid: string;
  parent_ref: string | null;
  is_root: boolean;
  role: "original" | "variation" | "discharge" | "nma" | null;
};

export type ApplicationFull = Lead & {
  start_date: string | null;
  in_leads_sheet: boolean;
  date_received: string | null;
  date_validated: string | null;
  target_decision_date: string | null;
  consultation_start_date: string | null;
  consultation_end_date: string | null;
  neighbour_consultation_start_date: string | null;
  neighbour_consultation_end_date: string | null;
  application_expires_date: string | null;
  decision_issued_date: string | null;
  decision_published_date: string | null;
  permission_expires: string | null;
  appeal_date: string | null;
  appeal_decision_date: string | null;
  comment_date: string | null;
  decision: string | null;
  decided_by: string | null;
  source_status: string | null;
  application_type: string | null;
  development_type: string | null;
  ward: string | null;
  parish: string | null;
  uprn: string | null;
  distance_km: number | null;
  n_documents: number | null;
  n_comments: number | null;
  n_constraints: number | null;
  n_statutory_days: number | null;
  applicant_address: string | null;
  appeal_reference: string | null;
  appeal_result: string | null;
  planning_portal_id: string | null;
  last_changed: string | null;
  last_different: string | null;
  last_scraped: string | null;
  // Full URLs from the applications_full view (join on uid).
  council_url: string | null;
  docs_url: string | null;
  comment_url: string | null;
  map_url: string | null;
  source_url: string | null;
};

export type StateHistoryRow = {
  id: number;
  uid: string;
  observed_at: string;
  old_state: string | null;
  new_state: string | null;
  decided_date: string | null;
  decision: string | null;
  last_different: string | null;
};

export type OutreachEntry = {
  id: string;
  uid: string;
  contacted_at: string;
  channel: string | null;
  to_name: string | null;
  to_email: string | null;
  status: string;
  follow_up_on: string | null;
  notes: string | null;
  created_by: string;
  created_by_email: string | null;
  created_at: string;
};

export type ProjectMeta = {
  starred: boolean;
  hidden: boolean;
  notes: string | null;
};

/** Row of the projects_feed view (migration 003) — one row per project. */
export type ProjectFeedRow = {
  id: number;
  authority: string;
  name: string | null;
  n_applications: number;
  root_in_db: boolean | null;
  first_seen: string | null;
  last_updated: string | null;
  root_uid: string | null;
  latest_uid: string | null;
  root_reference: string | null;
  root_description: string | null;
  filed_date: string | null;
  root_state: string | null;
  latest_reference: string | null;
  latest_state: string | null;
  latest_role: string | null;
  starred_by_me: boolean;
  starred_by_others: boolean;
  hidden: boolean;
  root_state_group: "approved" | "not_approved" | "pending" | "other";
  practice_status: PracticeStatus;
  /** tsvector of the root description (migration 007); supabase-js returns it as a string. */
  root_description_tsv: string | null;
};

/** Three-state practice signal on the projects feed (migration 004). */
export type PracticeStatus = "none" | "agent" | "assigned";

export type Practice = {
  id: string;
  name: string;
  website: string | null;
  notes: string | null;
  created_by: string;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
};

export type PracticeContact = {
  id: string;
  practice_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  notes: string | null;
  created_by: string;
  created_by_email: string | null;
  created_at: string;
};

/** A project-to-practice assignment joined with the shared practice record. */
export type ProjectPractice = {
  id: string;
  project_id: number;
  practice_id: string;
  role: string | null;
  notes: string | null;
  created_by: string;
  created_by_email: string | null;
  created_at: string;
  practice: Practice;
  contacts: PracticeContact[];
};

/** PlanIt agent values aggregated across a project's applications (read-only). */
export type ProjectAgent = {
  agent_company: string | null;
  agent_name: string | null;
  agent_address: string | null;
  references: string[];
};

export type Job = {
  id: number;
  kind: "backfill" | "sync";
  area: string | null;
  status: "pending" | "running" | "done" | "failed";
  started_at: string | null;
  finished_at: string | null;
  stats: Record<string, unknown> | null;
  error: string | null;
};

export const OUTREACH_STATUSES = [
  "contacted",
  "replied",
  "follow_up",
  "won",
  "lost",
  "no_interest",
] as const;

export const OUTREACH_CHANNELS = ["email", "phone", "linkedin", "other"] as const;
