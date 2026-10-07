// Pure filter helpers for the project-grouped leads page — no server imports,
// safe for client components.

export const PAGE_SIZE = 50;

export type RootStatusGroup = "approved" | "not_approved" | "pending" | "other";

export type ProjectFilters = {
  boroughs: string[];
  filedFrom: string | null; // ISO date — projects_feed.filed_date
  filedTo: string | null;
  updatedFrom: string | null; // ISO date — projects.last_updated
  updatedTo: string | null;
  rootStatus: RootStatusGroup[];
  q: string | null;
  starred: boolean;
  sort: "last_updated" | "filed_date" | "name";
  dir: "asc" | "desc";
  page: number; // 1-based
};

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function defaultProjectFilters(): ProjectFilters {
  return {
    boroughs: [],
    filedFrom: null,
    filedTo: null,
    updatedFrom: daysAgo(90),
    updatedTo: null,
    rootStatus: [],
    q: null,
    starred: false,
    sort: "last_updated",
    dir: "desc",
    page: 1,
  };
}

const ROOT_STATUS_GROUPS: RootStatusGroup[] = [
  "approved",
  "not_approved",
  "pending",
  "other",
];

/** Parse URL search params into ProjectFilters (missing params = defaults). */
export function parseProjectFilters(
  sp: Record<string, string | string[] | undefined>
): ProjectFilters {
  const d = defaultProjectFilters();
  const str = (k: string) => {
    const v = sp[k];
    return typeof v === "string" && v !== "" ? v : null;
  };

  const sort = str("sort");
  const dir = str("dir");
  const updatedFrom = str("updatedFrom");
  return {
    boroughs: str("borough")?.split(",").filter(Boolean) ?? [],
    filedFrom: str("filedFrom"),
    filedTo: str("filedTo"),
    // "updatedFrom=any" lets the user clear the default 90-day window.
    updatedFrom: updatedFrom === "any" ? null : (updatedFrom ?? d.updatedFrom),
    updatedTo: str("updatedTo"),
    rootStatus: (str("rootStatus")?.split(",") ?? []).filter((s): s is RootStatusGroup =>
      ROOT_STATUS_GROUPS.includes(s as RootStatusGroup)
    ),
    q: str("q"),
    starred: str("starred") === "1",
    sort:
      sort === "filed_date" || sort === "name" ? sort : "last_updated",
    dir: dir === "asc" ? "asc" : "desc",
    page: Math.max(1, parseInt(str("page") ?? "1", 10) || 1),
  };
}

/** Serialise filters back to URL search params (defaults omitted). */
export function projectFiltersToParams(f: ProjectFilters): URLSearchParams {
  const d = defaultProjectFilters();
  const p = new URLSearchParams();
  if (f.boroughs.length) p.set("borough", f.boroughs.join(","));
  if (f.filedFrom) p.set("filedFrom", f.filedFrom);
  if (f.filedTo) p.set("filedTo", f.filedTo);
  if (f.updatedFrom !== d.updatedFrom)
    p.set("updatedFrom", f.updatedFrom ?? "any");
  if (f.updatedTo) p.set("updatedTo", f.updatedTo);
  if (f.rootStatus.length) p.set("rootStatus", f.rootStatus.join(","));
  if (f.q) p.set("q", f.q);
  if (f.starred) p.set("starred", "1");
  if (f.sort !== d.sort) p.set("sort", f.sort);
  if (f.dir !== d.dir) p.set("dir", f.dir);
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}
