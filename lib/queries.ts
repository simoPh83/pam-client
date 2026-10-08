import { createClient } from "@/lib/supabase/server";
import type {
  ApplicationFull,
  Job,
  Lead,
  OutreachEntry,
  Practice,
  PracticeContact,
  ProjectAgent,
  ProjectFeedRow,
  ProjectMeta,
  ProjectPractice,
  StateHistoryRow,
} from "@/lib/types";
import { PAGE_SIZE, type ProjectFilters } from "@/lib/project-filters";
import type { Project, ProjectMembership } from "@/lib/types";

export { PAGE_SIZE } from "@/lib/project-filters";

/**
 * Normalise user boolean syntax into websearch_to_tsquery input:
 * strips parentheses, turns `&`/`AND` into implicit AND (space) and
 * `NOT x` into `-x`. OR, "quoted phrases" and -negation pass through.
 */
function toWebsearchQuery(input: string): string {
  return input
    .replace(/[()&]/g, " ")
    .replace(/\bNOT\s+(\S+)/gi, "-$1")
    .replace(/\bAND\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
  if (f.practice) query = query.eq("practice_status", f.practice);
  if (f.q) {
    const like = `%${f.q.replace(/[%,()]/g, " ")}%`;
    query = query.ilike("name", like);
  }
  if (f.desc?.trim()) {
    // Full-text search over the precomputed root-description tsvector
    // (migration 007 — trigram ILIKE was unusable for common terms).
    // websearch syntax: words AND by default, OR, "quoted phrases",
    // -negation; a few extra boolean conventions are normalised below.
    const tsq = toWebsearchQuery(f.desc);
    if (tsq) {
      query = query.textSearch("root_description_tsv", tsq, {
        config: "english",
        type: "websearch",
      });
    }
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

/** Shared practice assignments for a project, with practice + contacts. */
export async function getProjectPractices(
  projectId: number
): Promise<ProjectPractice[]> {
  const supabase = await createClient();

  const { data: links, error } = await supabase
    .from("ui_project_practices")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!links?.length) return [];

  const practiceIds = [...new Set(links.map((l) => l.practice_id as string))];
  const [practicesRes, contactsRes] = await Promise.all([
    supabase.from("ui_practices").select("*").in("id", practiceIds),
    supabase
      .from("ui_practice_contacts")
      .select("*")
      .in("practice_id", practiceIds)
      .order("created_at", { ascending: true }),
  ]);
  if (practicesRes.error) throw practicesRes.error;
  if (contactsRes.error) throw contactsRes.error;

  const practiceById = new Map(
    ((practicesRes.data ?? []) as Practice[]).map((p) => [p.id, p])
  );
  const contactsByPractice = new Map<string, PracticeContact[]>();
  for (const c of (contactsRes.data ?? []) as PracticeContact[]) {
    const list = contactsByPractice.get(c.practice_id) ?? [];
    list.push(c);
    contactsByPractice.set(c.practice_id, list);
  }

  return links
    .map((l) => {
      const practice = practiceById.get(l.practice_id as string);
      if (!practice) return null;
      return {
        ...(l as Omit<ProjectPractice, "practice" | "contacts">),
        practice,
        contacts: contactsByPractice.get(practice.id) ?? [],
      };
    })
    .filter((p): p is ProjectPractice => p !== null);
}

/**
 * PlanIt agent values across all applications of a project, deduplicated by
 * normalised company|person|address. Read-only application data — never
 * stored. Blank and "?" placeholder values are ignored, stray leading/trailing
 * quotes trimmed (known fetcher data-quality issues).
 */
export async function getProjectAgents(
  projectId: number
): Promise<ProjectAgent[]> {
  const supabase = await createClient();

  const { data: members, error: mErr } = await supabase
    .from("project_applications")
    .select("uid")
    .eq("project_id", projectId);
  if (mErr) throw mErr;
  if (!members?.length) return [];

  const { data: apps, error } = await supabase
    .from("applications")
    .select("reference, agent_company, agent_name, agent_address")
    .in(
      "uid",
      members.map((m) => m.uid as string)
    );
  if (error) throw error;

  const clean = (v: string | null): string | null => {
    if (v == null) return null;
    const t = v.replace(/^['"]+|['"]+$/g, "").trim();
    return t === "" || t === "?" ? null : t;
  };

  const byKey = new Map<string, ProjectAgent>();
  for (const a of apps ?? []) {
    const company = clean(a.agent_company as string | null);
    const name = clean(a.agent_name as string | null);
    const address = clean(a.agent_address as string | null);
    if (!company && !name) continue;
    const key = [company, name, address]
      .map((v) => (v ?? "").toLowerCase())
      .join("|");
    const existing = byKey.get(key);
    const reference = (a.reference as string | null) ?? null;
    if (existing) {
      if (reference && !existing.references.includes(reference))
        existing.references.push(reference);
    } else {
      byKey.set(key, {
        agent_company: company,
        agent_name: name,
        agent_address: address,
        references: reference ? [reference] : [],
      });
    }
  }

  return [...byKey.values()].sort((a, b) =>
    (a.agent_company ?? a.agent_name ?? "").localeCompare(
      b.agent_company ?? b.agent_name ?? ""
    )
  );
}

/** Search the shared practice register by name (case-insensitive). */
export async function searchPractices(
  query: string,
  limit = 10
): Promise<Practice[]> {
  const supabase = await createClient();
  const like = `%${query.replace(/[%,()]/g, " ")}%`;
  const { data, error } = await supabase
    .from("ui_practices")
    .select("*")
    .ilike("name", like)
    .order("name", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Practice[];
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
