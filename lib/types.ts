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

export type LeadMeta = {
  uid: string;
  starred: boolean;
  hidden: boolean;
  notes: string | null;
  updated_at: string;
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
