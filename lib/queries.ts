import { createClient } from "@/lib/supabase/server";
import type {
  ApplicationFull,
  GroupingReview,
  GroupingReviewCandidate,
  Job,
  Lead,
  OutreachEntry,
  Practice,
  PracticeContact,
  ProjectAgent,
  ProjectFeedRow,
  ProjectGroupingReview,
  ProjectMeta,
  ProjectPractice,
  SchemeCandidate,
  StateHistoryRow,
  UnlinkedNoSchemeRow,
} from "@/lib/types";
import { PAGE_SIZE, type ProjectFilters } from "@/lib/project-filters";
import type { GroupingState, Project, ProjectMembership, SplitRequest } from "@/lib/types";

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
  if (f.appsMin != null) query = query.gte("n_applications", f.appsMin);
  if (f.appsMax != null) query = query.lte("n_applications", f.appsMax);
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
  const rows = (data ?? []) as Omit<
    ProjectFeedRow,
    | "address_key"
    | "grouping_state"
    | "unlinked_application_count"
    | "has_missing_ancestors"
    | "all_members_have_parent_refs"
  >[];
  const projectIds = rows.map((row) => row.id);
  const projectById = new Map<
    number,
    {
      address_key: string | null;
      grouping_state: GroupingState;
      has_missing_ancestors: boolean;
    }
  >();

  if (projectIds.length) {
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, address_key, grouping_state, has_missing_ancestors, root_in_db")
      .in("id", projectIds);
    if (projectsError) throw projectsError;

    for (const project of projects ?? []) {
      const state = project.grouping_state as GroupingState;
      if (!["clean", "provisional", "ambiguous"].includes(state)) {
        throw new Error(`Project ${project.id} has an unknown grouping state`);
      }
      projectById.set(project.id as number, {
        address_key: (project.address_key as string | null) ?? null,
        grouping_state: state,
        // Falls back to the legacy flag until the backend backfill has run.
        has_missing_ancestors:
          (project.has_missing_ancestors as boolean | null) ??
          project.root_in_db === false,
      });
    }

    const missingProject = projectIds.find((id) => !projectById.has(id));
    if (missingProject != null) {
      throw new Error(`Grouping metadata is missing for project ${missingProject}`);
    }
  }

  const membersWithRefs = new Map<number, boolean>();
  if (projectIds.length) {
    const { data: memberships, error: membershipsError } = await supabase
      .from("project_applications")
      .select("project_id, parent_ref")
      .in("project_id", projectIds);
    if (membershipsError) throw membershipsError;

    for (const membership of memberships ?? []) {
      const projectId = membership.project_id as number;
      const hasParentRef = membership.parent_ref != null;
      membersWithRefs.set(
        projectId,
        (membersWithRefs.get(projectId) ?? true) && hasParentRef
      );
    }
  }

  const unlinkedCounts = new Map<number, number>();
  const addressKeys = [
    ...new Set(
      projectIds
        .map((id) => projectById.get(id)?.address_key)
        .filter((key): key is string => Boolean(key))
    ),
  ];
  const authorities = [...new Set(rows.map((row) => row.authority).filter(
    (authority): authority is string => Boolean(authority)
  ))];
  if (addressKeys.length && authorities.length) {
    const { data: reviews, error: reviewsError } = await supabase
      .from("grouping_review")
      .select("id, authority, address_key, candidates")
      .eq("reason", "unlinked_multi_scheme")
      .eq("status", "pending")
      .in("address_key", addressKeys)
      .in("authority", authorities);
    if (reviewsError) throw reviewsError;

    const projectIdsByAddress = new Map<string, Set<number>>();
    const authorityByProjectId = new Map(
      rows.map((row) => [row.id, row.authority])
    );
    for (const id of projectIds) {
      const project = projectById.get(id);
      const authority = authorityByProjectId.get(id);
      if (!project?.address_key || !authority) continue;
      const key = `${authority}\u001f${project.address_key}`;
      const ids = projectIdsByAddress.get(key) ?? new Set<number>();
      ids.add(id);
      projectIdsByAddress.set(key, ids);
    }

    for (const review of reviews ?? []) {
      const key = `${review.authority}\u001f${review.address_key}`;
      const matchingIds = projectIdsByAddress.get(key);
      if (!matchingIds) continue;

      const reviewCandidateIds = new Set(
        ((review.candidates ?? []) as GroupingReviewCandidate[])
          .map((candidate) => Number(candidate.project_id))
          .filter((id) => Number.isSafeInteger(id))
      );
      for (const id of matchingIds) {
        if (reviewCandidateIds.has(id)) {
          unlinkedCounts.set(id, (unlinkedCounts.get(id) ?? 0) + 1);
        }
      }
    }
  }

  // For projects with unresolved ancestors, annotate with the parent-hunt
  // status so the UI can explain ("being fetched" vs "not found").
  const missingIds = rows
    .filter((r) => projectById.get(r.id)?.has_missing_ancestors)
    .map((r) => r.id);
  const statusByProject = new Map<number, string>();
  if (missingIds.length) {
    const { data: mp } = await supabase
      .from("missing_parents")
      .select("project_id, status")
      .in("project_id", missingIds);
    for (const r of mp ?? []) {
      // status is pending | exhausted; exhausted wins. Legacy "found" rows are ignored.
      const cur = r.status as string;
      if (cur !== "pending" && cur !== "exhausted") continue;
      const prev = statusByProject.get(r.project_id as number);
      if (!prev || cur === "exhausted") statusByProject.set(r.project_id as number, cur);
    }
  }

  return {
    rows: rows.map((r) => {
      const project = projectById.get(r.id);
      if (!project) {
        throw new Error(`Grouping metadata is missing for project ${r.id}`);
      }
      return {
        ...r,
        address_key: project.address_key,
        grouping_state: project.grouping_state,
        has_missing_ancestors: project.has_missing_ancestors,
        all_members_have_parent_refs: membersWithRefs.get(r.id) ?? false,
        unlinked_application_count: unlinkedCounts.get(r.id) ?? 0,
        missing_parent_status: statusByProject.get(r.id) ?? null,
      };
    }),
    total: count ?? 0,
  };
}

/** Pending review items that are relevant to a scheme's project page. */
export async function getProjectGroupingReviews(
  project: Project
): Promise<ProjectGroupingReview[]> {
  const supabase = await createClient();
  const [multiRootResult, unlinkedResult] = await Promise.all([
    supabase
      .from("grouping_review")
      .select("*")
      .eq("reason", "multi_root")
      .eq("status", "pending")
      .eq("project_id", project.id)
      .order("created_at", { ascending: true }),
    project.address_key
      ? supabase
          .from("grouping_review")
          .select("*")
          .eq("reason", "unlinked_multi_scheme")
          .eq("status", "pending")
          .eq("authority", project.authority)
          .eq("address_key", project.address_key)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (multiRootResult.error) throw multiRootResult.error;
  if (unlinkedResult.error) throw unlinkedResult.error;

  const multiRootReviews = (multiRootResult.data ?? []) as GroupingReview[];
  const unlinkedReviews = ((unlinkedResult.data ?? []) as GroupingReview[]).filter(
    (review) =>
      review.candidates.some(
        (candidate) => Number(candidate.project_id) === project.id
      )
  );
  const reviews = [...multiRootReviews, ...unlinkedReviews];
  const orphanUids = [
    ...new Set(
      unlinkedReviews
        .map((review) => review.uid)
        .filter((uid): uid is string => Boolean(uid))
    ),
  ];
  // Candidate payloads from grouping_review don't carry addresses; enrich
  // from applications so cards can show where each candidate sits.
  const candidateUids = reviews.flatMap((review) =>
    (review.candidates ?? [])
      .map((candidate) => candidate.uid)
      .filter((uid): uid is string => Boolean(uid))
  );
  const lookupUids = [...new Set([...orphanUids, ...candidateUids])];

  const { data: applications, error: applicationsError } = lookupUids.length
    ? await supabase
        .from("applications")
        .select("uid, reference, description, app_type, start_date, address")
        .in("uid", lookupUids)
    : { data: [], error: null };
  if (applicationsError) throw applicationsError;
  const appByUid = new Map((applications ?? []).map((app) => [app.uid, app]));

  return reviews.map((review) => {
    const orphan = review.uid ? appByUid.get(review.uid) : null;
    return {
      ...review,
      candidates: ((review.candidates ?? []) as GroupingReviewCandidate[]).map(
        (candidate) => ({
          ...candidate,
          address: candidate.uid
            ? ((appByUid.get(candidate.uid)?.address as string | null) ?? null)
            : null,
        })
      ),
      orphan: orphan
        ? {
            uid: orphan.uid as string,
            reference: (orphan.reference as string | null) ?? null,
            description: (orphan.description as string | null) ?? null,
            app_type: (orphan.app_type as string | null) ?? null,
            start_date: (orphan.start_date as string | null) ?? null,
          }
        : null,
    };
  });
}

/**
 * In-flight split request for a project, if any. The worker picks these up
 * within ~1 min when idle (see docs/2026-10-12-split-wiring-frontend.md).
 */
export async function getSplitRequest(
  projectId: number
): Promise<SplitRequest | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("split_requests")
    .select("status, error")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw error;
  return (data as SplitRequest | null) ?? null;
}

/** Page of parentless applications that currently have no scheme to join. */
export async function getUnlinkedNoSchemeReviews(
  page = 1
): Promise<{ rows: UnlinkedNoSchemeRow[]; total: number }> {
  const supabase = await createClient();
  const safePage = Math.max(1, page);
  const { data: reviews, error, count } = await supabase
    .from("grouping_review")
    .select("id, uid, authority, address_key, created_at", { count: "exact" })
    .eq("reason", "unlinked_no_scheme")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE - 1);
  if (error) throw error;

  const reviewRows = (reviews ?? []).filter(
    (review): review is typeof review & { uid: string } =>
      typeof review.uid === "string" && review.uid.length > 0
  );
  const uids = reviewRows.map((review) => review.uid);
  const { data: applications, error: applicationsError } = uids.length
    ? await supabase
        .from("applications")
        .select("uid, address, reference, description, app_type")
        .in("uid", uids)
    : { data: [], error: null };
  if (applicationsError) throw applicationsError;

  const appByUid = new Map((applications ?? []).map((app) => [app.uid, app]));
  return {
    rows: reviewRows.map((review) => {
      const app = appByUid.get(review.uid);
      return {
        id: review.id as number,
        uid: review.uid,
        authority: review.authority as string,
        address_key: (review.address_key as string | null) ?? null,
        address: (app?.address as string | null) ?? null,
        reference: (app?.reference as string | null) ?? null,
        description: (app?.description as string | null) ?? null,
        app_type: (app?.app_type as string | null) ?? null,
        created_at: review.created_at as string,
      };
    }),
    total: count ?? 0,
  };
}

/** Enrich project ids into scheme cards (root/latest application details). */
async function buildSchemeCandidates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectIds: number[]
): Promise<SchemeCandidate[]> {
  if (!projectIds.length) return [];
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, root_uid, latest_uid, n_applications")
    .in("id", projectIds);
  if (error) throw error;

  const uids = [
    ...new Set(
      (projects ?? []).flatMap((p) =>
        [p.root_uid, p.latest_uid].filter((u): u is string => Boolean(u))
      )
    ),
  ];
  const { data: apps, error: appsError } = uids.length
    ? await supabase
        .from("applications")
        .select("uid, address, description, app_type, start_date, decided_date")
        .in("uid", uids)
    : { data: [], error: null };
  if (appsError) throw appsError;
  const appByUid = new Map((apps ?? []).map((a) => [a.uid, a]));

  return (projects ?? []).map((p) => {
    const root = p.root_uid ? appByUid.get(p.root_uid) : undefined;
    const latest = p.latest_uid ? appByUid.get(p.latest_uid) : undefined;
    return {
      project_id: p.id as number,
      address: ((root ?? latest)?.address as string | null) ?? null,
      description:
        ((latest ?? root)?.description as string | null) ?? null,
      app_type: (root?.app_type as string | null) ?? null,
      start_date: (root?.start_date as string | null) ?? null,
      decided_date: (latest?.decided_date as string | null) ?? null,
      n_applications: (p.n_applications as number | null) ?? 0,
    };
  });
}

/** Schemes at the same (authority, address_key) as a review row. */
export async function getSameAddressSchemes(
  authority: string,
  addressKey: string | null
): Promise<SchemeCandidate[]> {
  if (!addressKey) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("authority", authority)
    .eq("address_key", addressKey)
    .limit(100);
  if (error) throw error;
  return buildSchemeCandidates(
    supabase,
    (data ?? []).map((p) => p.id as number)
  );
}

export const POSTCODE_PAGE_SIZE = 50;

/**
 * Schemes whose applications share the postcode of `uid`. Paginates over
 * applications and groups them by project, so a page may yield fewer
 * schemes than POSTCODE_PAGE_SIZE.
 */
export async function getSamePostcodeSchemes(
  uid: string,
  page = 1
): Promise<{ schemes: SchemeCandidate[]; hasMore: boolean }> {
  const supabase = await createClient();
  const { data: self, error: selfError } = await supabase
    .from("applications")
    .select("postcode")
    .eq("uid", uid)
    .maybeSingle();
  if (selfError) throw selfError;
  const compact = String(self?.postcode ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (compact.length < 5) return { schemes: [], hasMore: false };

  // Postcodes are stored with or without the space; match both forms.
  const pattern = `${compact.slice(0, -3)}%${compact.slice(-3)}`;
  const from = (Math.max(1, page) - 1) * POSTCODE_PAGE_SIZE;
  const { data: apps, error } = await supabase
    .from("applications")
    .select("uid")
    .ilike("postcode", pattern)
    .neq("uid", uid)
    .order("uid", { ascending: true })
    .range(from, from + POSTCODE_PAGE_SIZE);
  if (error) throw error;

  const rows = apps ?? [];
  const hasMore = rows.length > POSTCODE_PAGE_SIZE;
  const uids = rows.slice(0, POSTCODE_PAGE_SIZE).map((a) => a.uid as string);
  if (!uids.length) return { schemes: [], hasMore };

  const { data: membership, error: memberError } = await supabase
    .from("project_applications")
    .select("project_id")
    .in("uid", uids);
  if (memberError) throw memberError;
  const projectIds = [
    ...new Set((membership ?? []).map((m) => m.project_id as number)),
  ];
  return { schemes: await buildSchemeCandidates(supabase, projectIds), hasMore };
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

export type MissingParent = {
  authority: string;
  reference: string;
  requested_by: string | null;
  status: "pending" | "exhausted";
  attempts: number | null;
};

/** Unresolved parent references for a project (legacy "found" rows ignored). */
export async function getProjectMissingParents(
  projectId: number,
  rootInDb?: boolean | null
): Promise<MissingParent[]> {
  // A root already in the DB means any leftover row is stale.
  if (rootInDb === true) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("missing_parents")
    .select("authority, reference, requested_by, status, attempts")
    .eq("project_id", projectId)
    .in("status", ["pending", "exhausted"]);
  return (data ?? []) as MissingParent[];
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
    // project_applications should hold exactly one row per uid, but dual
    // memberships exist until the backend repairs the invariant (see
    // docs/2026-10-12-backend-issue-dual-membership.md). maybeSingle() would
    // error on duplicates, so fetch a few and pick the richest project.
    supabase
      .from("project_applications")
      .select("project_id, projects(n_applications)")
      .eq("uid", uid)
      .limit(5),
  ]);

  if (appRes.error) throw appRes.error;
  if (!appRes.data) {
    return { app: null, history: [], outreach: [], meta: null, otherByAgent: [] };
  }

  const memberships = (memberRes.data ?? []) as {
    project_id: number;
    // PostgREST may type the to-one embed as an array; handle both shapes.
    projects: { n_applications: number }[] | { n_applications: number } | null;
  }[];
  const memberCount = (m: (typeof memberships)[number]): number => {
    const p = Array.isArray(m.projects) ? m.projects[0] : m.projects;
    return p?.n_applications ?? 0;
  };
  const bestMembership = [...memberships].sort(
    (a, b) => memberCount(b) - memberCount(a) || a.project_id - b.project_id
  )[0];

  const app = {
    ...(appRes.data as Record<string, unknown>),
    ...(fullRes.data ?? {}),
    // applications has no project_id. Prefer project_applications (covers all
    // members incl. non-leads); fall back to the leads view for leads.
    project_id: bestMembership?.project_id ?? leadRes.data?.project_id ?? null,
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
