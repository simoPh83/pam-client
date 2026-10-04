// Pure filter helpers — no server imports, safe for client components.

export const PAGE_SIZE = 50;

export type LeadFilters = {
  boroughs: string[];
  states: string[];
  sizes: string[];
  decidedFrom: string | null; // ISO date
  decidedTo: string | null;
  appType: string | null;
  agent: string | null;
  q: string | null;
  hasAgent: boolean;
  notContacted: boolean;
  starred: boolean;
  sort: "decided_date" | "authority" | "app_size" | "app_state";
  dir: "asc" | "desc";
  page: number; // 1-based
};

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function defaultFilters(): LeadFilters {
  return {
    boroughs: [],
    states: [],
    sizes: ["Medium", "Large"],
    decidedFrom: daysAgo(90),
    decidedTo: null,
    appType: null,
    agent: null,
    q: null,
    hasAgent: false,
    notContacted: false,
    starred: false,
    sort: "decided_date",
    dir: "desc",
    page: 1,
  };
}

/** Parse URL search params into LeadFilters (missing params = defaults). */
export function parseFilters(
  sp: Record<string, string | string[] | undefined>
): LeadFilters {
  const d = defaultFilters();
  const str = (k: string) => {
    const v = sp[k];
    return typeof v === "string" && v !== "" ? v : null;
  };
  const list = (k: string) => str(k)?.split(",").filter(Boolean) ?? [];

  const sort = str("sort");
  const dir = str("dir");
  return {
    boroughs: list("borough"),
    states: list("state"),
    sizes: list("size").length ? list("size") : d.sizes,
    decidedFrom: str("from") ?? d.decidedFrom,
    decidedTo: str("to"),
    appType: str("type"),
    agent: str("agent"),
    q: str("q"),
    hasAgent: str("hasAgent") === "1",
    notContacted: str("notContacted") === "1",
    starred: str("starred") === "1",
    sort:
      sort === "authority" || sort === "app_size" || sort === "app_state"
        ? sort
        : "decided_date",
    dir: dir === "asc" ? "asc" : "desc",
    page: Math.max(1, parseInt(str("page") ?? "1", 10) || 1),
  };
}

/** Serialise filters back to URL search params (defaults omitted). */
export function filtersToParams(f: LeadFilters): URLSearchParams {
  const d = defaultFilters();
  const p = new URLSearchParams();
  if (f.boroughs.length) p.set("borough", f.boroughs.join(","));
  if (f.states.length) p.set("state", f.states.join(","));
  if (f.sizes.join(",") !== d.sizes.join(",")) p.set("size", f.sizes.join(","));
  if (f.decidedFrom && f.decidedFrom !== d.decidedFrom)
    p.set("from", f.decidedFrom);
  if (f.decidedTo) p.set("to", f.decidedTo);
  if (f.appType) p.set("type", f.appType);
  if (f.agent) p.set("agent", f.agent);
  if (f.q) p.set("q", f.q);
  if (f.hasAgent) p.set("hasAgent", "1");
  if (f.notContacted) p.set("notContacted", "1");
  if (f.starred) p.set("starred", "1");
  if (f.sort !== d.sort) p.set("sort", f.sort);
  if (f.dir !== d.dir) p.set("dir", f.dir);
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}
