import { createClient } from "@/lib/supabase/server";
import type {
  ApplicationFull,
  Job,
  Lead,
  OutreachEntry,
  ProjectFeedRow,
  ProjectMeta,
  StateHistoryRow,
} from "@/lib/types";
import { PAGE_SIZE, type ProjectFilters } from "@/lib/project-filters";
import type { Project, ProjectMembership } from "@/lib/types";

export { PAGE_SIZE } from "@/lib/project-filters";

/** PostgREST filter fragments for the grouped root-status filter. */
export type ProjectFeedResult = {
  rows: (ProjectFeedRow & { missing_parent_status: string | null })[];
  total: number;
};

/** Project-grouped leads feed: one row per project from projects_feed. */
export async function getProjectsFeed(
  f: ProjectFilters
): Promise<ProjectFeedResult> {
  const supabase = await createClient();

  let query = supabase
    .from("projects_feed")
    .select("*", { count: "exact" })
    .eq("hidden", false);

  if (f.boroughs.length) query = query.in("authority", f.boroughs);
  if (f.filedFrom) query = query.gte("filed_date", f.filedFrom);
  if (f.filedTo) query = query.lte("filed_date", f.filedTo);
  if (f.updatedFrom) query = query.gte("last_updated", f.updatedFrom);
  if (f.updatedTo) query = query.lte("last_updated", f.updatedTo);
  if (f.rootStatus.length) query = query.in("root_state_group", f.rootStatus);
  if (f.q) {
    // Name-only in v1: matching root_description would force joining
    // applications for every candidate row (~15s). Revisit with a trigram
    // index or a worker-denormalised column.
    const like = `%${f.q.replace(/[%,()]/g, " ")}%`;
    query = query.ilike("name", like);
  }
  if (f.starred) query = query.eq("starred_by_me", true);

  query = query
    .order(f.sort, { ascending: f.dir === "asc", nullsFirst: false })
    .order("id", { ascending: true }) // stable tiebreaker
    .range((f.page - 1) * PAGE_SIZE, f.page * PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  const rows = (data ?? []) as ProjectFeedRow[];

  // For projects whose root isn't in the DB, annotate with the parent-hunt
  // status so the UI can explain ("being fetched" vs "not found").
  const missingIds = rows
    .filter((r) => r.root_in_db === false)
    .map((r) => r.id);
  const statusByProject = new Map<number, string>();
  if (missingIds.length) {
    const { data: mp } = await supabase
      .from("missing_parents")
      .select("project_id, status")
      .in("project_id", missingIds);
    for (const r of mp ?? []) {
      // worst-status wins: exhausted > pending > found
      const prev = statusByProject.get(r.project_id as number);
      const cur = r.status as string;
      if (!prev || cur === "exhausted" || (cur === "pending" && prev === "found"))
        statusByProject.set(r.project_id as number, cur);
    }
  }

  return {
    rows: rows.map((r) => ({
      ...r,
      missing_parent_status: statusByProject.get(r.id) ?? null,
    })),
    total: count ?? 0,
  };
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

export async function getLeadDetail(uid: string): Promise<{
  app: ApplicationFull | null;
  history: StateHistoryRow[];
  outreach: OutreachEntry[];
  meta: ProjectMeta | null;
  otherByAgent: Lead[];
}> {
  const supabase = await createClient();

  // project_id from project_applications (authoritative — covers ALL members,
  // including non-lead discharges/NMAs). Leads view only contains leads, so it
  // misses non-lead applications in a project.
  const [appRes, fullRes, histRes, outRes, leadRes, memberRes] =
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
    supabase.from("leads").select("project_id, n_applications").eq("uid", uid).maybeSingle(),
    supabase.from("project_applications").select("project_id").eq("uid", uid).maybeSingle(),
  ]);

  if (appRes.error) throw appRes.error;
  if (!appRes.data) {
    return { app: null, history: [], outreach: [], meta: null, otherByAgent: [] };
  }

  const app = {
    ...(appRes.data as Record<string, unknown>),
    ...(fullRes.data ?? {}),
    // applications has no project_id. Prefer project_applications (covers all
    // members incl. non-leads); fall back to the leads view for leads.
    project_id: memberRes.data?.project_id ?? leadRes.data?.project_id ?? null,
    n_applications: leadRes.data?.n_applications ?? null,
  } as ApplicationFull;

  // Per-user project metadata (star/hidden/notes) — only meaningful when the
  // application belongs to a project. Stars are read-shared, so restrict to
  // the current user's own row.
  let meta: ProjectMeta | null = null;
  if (app.project_id != null) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const [starRes, metaRes] = await Promise.all([
      user
        ? supabase
            .from("ui_project_stars")
            .select("project_id")
            .eq("project_id", app.project_id)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("ui_project_meta")
        .select("hidden, notes")
        .eq("project_id", app.project_id)
        .maybeSingle(),
    ]);
    meta = {
      starred: starRes.data != null,
      hidden: metaRes.data?.hidden ?? false,
      notes: metaRes.data?.notes ?? null,
    };
  }

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
    meta,
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
