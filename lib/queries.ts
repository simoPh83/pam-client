import { createClient } from "@/lib/supabase/server";
import type {
  ApplicationFull,
  Job,
  Lead,
  LeadMeta,
  OutreachEntry,
  StateHistoryRow,
} from "@/lib/types";
import { PAGE_SIZE, type LeadFilters } from "@/lib/filters";
import type { Project, ProjectMembership } from "@/lib/types";

export { PAGE_SIZE, parseFilters, filtersToParams, defaultFilters, daysAgo } from "@/lib/filters";
export type { LeadFilters } from "@/lib/filters";

/** Row displayed in the leads table: a lead + project roll-up fields. */
export type LeadRow = Lead & {
  project_last_updated: string | null;
  root_decided_date: string | null;
};

/** Collapse a page of leads into one row per project (ungrouped rows pass through). */
export async function groupLeads(rows: Lead[]): Promise<LeadRow[]> {
  const byProject = new Map<number, Lead[]>();
  const result: LeadRow[] = [];

  for (const lead of rows) {
    if (lead.project_id && (lead.n_applications ?? 1) > 1) {
      const list = byProject.get(lead.project_id) ?? [];
      list.push(lead);
      byProject.set(lead.project_id, list);
    } else {
      result.push({ ...lead, project_last_updated: null, root_decided_date: null });
    }
  }
  if (byProject.size === 0) return result;

  const supabase = await createClient();
  const ids = [...byProject.keys()];
  const { data: projects } = await supabase
    .from("projects")
    .select("id, root_uid, latest_uid, last_updated")
    .in("id", ids);
  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));

  // Fetch root rows for projects whose root isn't on this page (and isn't the rep).
  const rootUids = new Set<string>();
  for (const [pid, members] of byProject) {
    const rootUid = projectById.get(pid)?.root_uid;
    if (rootUid && !members.some((m) => m.uid === rootUid)) rootUids.add(rootUid);
  }
  const rootDateByUid = new Map<string, string | null>();
  if (rootUids.size) {
    const { data: roots } = await supabase
      .from("applications")
      .select("uid, decided_date")
      .in("uid", [...rootUids]);
    for (const r of roots ?? []) rootDateByUid.set(r.uid, r.decided_date);
  }

  for (const [pid, members] of byProject) {
    const project = projectById.get(pid);
    // Representative: the project's latest member if present on this page,
    // else the first member in the page's (already-sorted) order.
    const rep =
      members.find((m) => m.uid === project?.latest_uid) ?? members[0];
    const rootOnPage = members.find((m) => m.uid === project?.root_uid);
    result.push({
      ...rep,
      project_last_updated: project?.last_updated ?? null,
      root_decided_date: project?.root_uid
        ? (rootOnPage?.decided_date ?? rootDateByUid.get(project.root_uid) ?? null)
        : null,
    });
  }
  return result;
}

export async function getProjectBundle(projectId: number | string): Promise<{
  project: Project | null;
  members: (ProjectMembership & {
    reference: string | null;
    app_state: string | null;
    app_type: string | null;
    decided_date: string | null;
    description: string | null;
  })[];
}> {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { project: null, members: [] };

  const { data: membership } = await supabase
    .from("project_applications")
    .select("*")
    .eq("project_id", projectId);
  const members = (membership ?? []) as ProjectMembership[];
  if (!members.length) return { project: project as Project, members: [] };

  const { data: apps } = await supabase
    .from("applications")
    .select("uid, reference, app_state, app_type, decided_date, description")
    .in(
      "uid",
      members.map((m) => m.uid)
    );
  const appByUid = new Map((apps ?? []).map((a) => [a.uid, a]));

  const joined = members.map((m) => {
    const a = appByUid.get(m.uid);
    return {
      ...m,
      reference: a?.reference ?? null,
      app_state: a?.app_state ?? null,
      app_type: a?.app_type ?? null,
      decided_date: a?.decided_date ?? null,
      description: a?.description ?? null,
    };
  });
  joined.sort((a, b) => {
    if (a.is_root !== b.is_root) return a.is_root ? -1 : 1;
    return (b.decided_date ?? "").localeCompare(a.decided_date ?? "");
  });

  return { project: project as Project, members: joined };
}

export async function getBoroughs(): Promise<string[]> {
  const supabase = await createClient();
  // authority_urls is a tiny table with one row per (authority, field).
  const { data, error } = await supabase
    .from("authority_urls")
    .select("authority");
  if (error) throw error;
  return [...new Set(data.map((r) => r.authority as string))].sort();
}

export async function getLeads(
  f: LeadFilters,
  { grouped = true }: { grouped?: boolean } = {}
): Promise<{
  rows: LeadRow[];
  total: number;
  contactedUids: Set<string>;
  metaByUid: Map<string, LeadMeta>;
}> {
  const supabase = await createClient();

  // uid sets for cross-table toggles (ui_* tables are small in v1).
  const [{ data: outreachUids }, { data: metaRows }] = await Promise.all([
    f.notContacted
      ? supabase.from("ui_outreach").select("uid")
      : Promise.resolve({ data: null }),
    supabase.from("ui_lead_meta").select("*"),
  ]);

  const contacted = new Set((outreachUids ?? []).map((r) => r.uid as string));
  const meta = new Map<string, LeadMeta>(
    (metaRows ?? []).map((m) => [m.uid, m as LeadMeta])
  );
  const starredUids = [...meta.values()].filter((m) => m.starred).map((m) => m.uid);
  const hiddenUids = [...meta.values()].filter((m) => m.hidden).map((m) => m.uid);

  let query = supabase.from("leads").select("*", { count: "exact" });

  if (f.boroughs.length) query = query.in("authority", f.boroughs);
  if (f.states.length) query = query.in("app_state", f.states);
  if (f.sizes.length) query = query.in("app_size", f.sizes);
  if (f.decidedFrom) query = query.gte("decided_date", f.decidedFrom);
  if (f.decidedTo) query = query.lte("decided_date", f.decidedTo);
  if (f.appType) query = query.eq("app_type", f.appType);
  if (f.agent) query = query.ilike("agent_display", `%${f.agent}%`);
  if (f.q) {
    const like = `%${f.q}%`;
    query = query.or(
      `description.ilike.${like},address.ilike.${like},postcode.ilike.${like}`
    );
  }
  if (f.hasAgent) query = query.not("agent_display", "is", null).neq("agent_display", "");
  if (f.notContacted && contacted.size)
    query = query.not("uid", "in", `(${[...contacted].join(",")})`);
  if (f.starred)
    query = starredUids.length
      ? query.in("uid", starredUids)
      : query.eq("uid", "__none__"); // no stars → no rows
  if (hiddenUids.length)
    query = query.not("uid", "in", `(${hiddenUids.join(",")})`);

  // In grouped mode, fetch a fuller set per page so collapsing by project
  // still yields ~PAGE_SIZE rows.
  const rangeSize = grouped ? PAGE_SIZE * 2 : PAGE_SIZE;

  query = query
    .order(f.sort, { ascending: f.dir === "asc", nullsFirst: false })
    .order("uid", { ascending: true }) // stable tiebreaker
    .range((f.page - 1) * rangeSize, f.page * rangeSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: grouped ? await groupLeads((data ?? []) as Lead[]) : ((data ?? []) as LeadRow[]),
    total: count ?? 0,
    contactedUids: contacted,
    metaByUid: meta,
  };
}

export async function getLeadDetail(uid: string): Promise<{
  app: ApplicationFull | null;
  history: StateHistoryRow[];
  outreach: OutreachEntry[];
  meta: LeadMeta | null;
  otherByAgent: Lead[];
}> {
  const supabase = await createClient();

  // Read project_id from the leads view (which the table page already uses
  // successfully) rather than a separate project_applications lookup — that
  // table's query was returning null under Next's fetch caching on this page.
  const [appRes, fullRes, histRes, outRes, metaRes, leadRes] =
    await Promise.all([
      supabase.from("applications").select("*").eq("uid", uid).maybeSingle(),
      supabase
        .from("applications_full")
        .select("council_url, docs_url, comment_url, map_url, source_url")
        .eq("uid", uid)
        .maybeSingle(),
      supabase
      .from("state_history")
      .select("*")
      .eq("uid", uid)
      .order("observed_at", { ascending: false }),
    supabase
      .from("ui_outreach")
      .select("*")
      .eq("uid", uid)
      .order("contacted_at", { ascending: false }),
    supabase.from("ui_lead_meta").select("*").eq("uid", uid).maybeSingle(),
    supabase.from("leads").select("project_id, n_applications").eq("uid", uid).maybeSingle(),
  ]);

  if (appRes.error) throw appRes.error;
  if (!appRes.data) {
    return { app: null, history: [], outreach: [], meta: null, otherByAgent: [] };
  }

  const app = {
    ...(appRes.data as Record<string, unknown>),
    ...(fullRes.data ?? {}),
    // applications has no project_id; it lives on the leads view. Attach it
    // (and the project size) so the detail page can render project tabs.
    project_id: leadRes.data?.project_id ?? null,
    n_applications: leadRes.data?.n_applications ?? null,
  } as ApplicationFull;

  let otherByAgent: Lead[] = [];
  if (app.agent_display) {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("agent_display", app.agent_display)
      .neq("uid", uid)
      .order("decided_date", { ascending: false, nullsFirst: false })
      .limit(10);
    otherByAgent = (data ?? []) as Lead[];
  }

  return {
    app,
    history: (histRes.data ?? []) as StateHistoryRow[],
    outreach: (outRes.data ?? []) as OutreachEntry[],
    meta: (metaRes.data as LeadMeta | null) ?? null,
    otherByAgent,
  };
}

export async function getOutreach(statusFilter?: string): Promise<{
  entries: OutreachEntry[];
  leadsByUid: Map<string, Lead>;
}> {
  const supabase = await createClient();

  let query = supabase
    .from("ui_outreach")
    .select("*")
    .order("follow_up_on", { ascending: true, nullsFirst: false })
    .order("contacted_at", { ascending: false })
    .limit(500);
  if (statusFilter) query = query.eq("status", statusFilter);

  const { data, error } = await query;
  if (error) throw error;
  const entries = (data ?? []) as OutreachEntry[];

  const uids = [...new Set(entries.map((e) => e.uid))];
  let leadsByUid = new Map<string, Lead>();
  if (uids.length) {
    const { data: leads } = await supabase
      .from("leads")
      .select("*")
      .in("uid", uids);
    leadsByUid = new Map(((leads ?? []) as Lead[]).map((l) => [l.uid, l]));
  }

  return { entries, leadsByUid };
}

export async function getJobsSummary(): Promise<{
  lastSyncByArea: { area: string; finished_at: string; status: string }[];
  queue: { status: string; count: number }[];
  recentFailed: Job[];
}> {
  const supabase = await createClient();

  const { data: done, error } = await supabase
    .from("jobs")
    .select("area, finished_at, status")
    .eq("status", "done")
    .order("finished_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  const seen = new Map<string, { area: string; finished_at: string; status: string }>();
  for (const j of done ?? []) {
    if (j.area && !seen.has(j.area)) {
      seen.set(j.area, {
        area: j.area,
        finished_at: j.finished_at,
        status: j.status,
      });
    }
  }

  const { data: pending } = await supabase
    .from("jobs")
    .select("status")
    .in("status", ["pending", "running"]);
  const queueMap = new Map<string, number>();
  for (const j of pending ?? [])
    queueMap.set(j.status, (queueMap.get(j.status) ?? 0) + 1);

  const { data: failed } = await supabase
    .from("jobs")
    .select("*")
    .eq("status", "failed")
    .order("finished_at", { ascending: false })
    .limit(10);

  return {
    lastSyncByArea: [...seen.values()].sort((a, b) => a.area.localeCompare(b.area)),
    queue: [...queueMap.entries()].map(([status, count]) => ({ status, count })),
    recentFailed: (failed ?? []) as Job[],
  };
}
