// Row shapes matching the Supabase schema (see web-client-kickoff/01-database-contract.md).
// Most date columns are TEXT in ISO YYYY-MM-DD form.

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
  first_seen: string | null;
  last_updated: string | null;
};

export type ApplicationFull = Lead & {
  date_received: string | null;
  date_validated: string | null;
  target_decision_date: string | null;
  consultation_end_date: string | null;
  decision_issued_date: string | null;
  permission_expires: string | null;
  decision: string | null;
  decided_by: string | null;
  development_type: string | null;
  ward: string | null;
  uprn: string | null;
  n_documents: number | null;
  n_comments: number | null;
  n_constraints: number | null;
  source_status: string | null;
  appeal_reference: string | null;
  appeal_result: string | null;
  planning_portal_id: string | null;
  in_leads_sheet: number | null;
  council_url: string | null;
  docs_url: string | null;
  comment_url: string | null;
  map_url: string | null;
  source_url: string | null;
};

export type StateHistoryRow = {
  id: number;
  uid: string;
  observed_at: string | null;
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
