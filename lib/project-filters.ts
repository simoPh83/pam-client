// Pure filter helpers for the project-grouped leads page — no server imports,
// safe for client components.

import type { PracticeStatus } from "@/lib/types";

export const PAGE_SIZE = 50;

export type RootStatusGroup = "approved" | "not_approved" | "pending" | "other";

export type ProjectFilters = {
  boroughs: string[];
  filedFrom: string | null; // ISO date — projects_feed.filed_date
  filedTo: string | null;
  updatedFrom: string | null; // ISO date — projects.last_updated
  updatedTo: string | null;
  rootStatus: RootStatusGroup[];
  practice: PracticeStatus | null; // projects_feed.practice_status
  q: string | null; // project name search
  desc: string | null; // root description search (trigram, min 3 chars)
  appsMin: number | null; // projects_feed.n_applications >= min
  appsMax: number | null; // projects_feed.n_applications <= max
  starred: boolean;
  sort: "last_updated" | "filed_date" | "name";
  dir: "asc" | "desc";
  page: number; // 1-based
};

export function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function defaultProjectFilters(): ProjectFilters {
  return {
    boroughs: [],
    filedFrom: null,
    filedTo: null,
    updatedFrom: monthsAgo(3),
    updatedTo: null,
    rootStatus: [],
    practice: null,
    q: null,
    desc: null,
    appsMin: null,
    appsMax: null,
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

const PRACTICE_STATUSES: PracticeStatus[] = ["none", "agent", "assigned"];

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
  const posInt = (k: string): number | null => {
    const n = parseInt(str(k) ?? "", 10);
    return Number.isSafeInteger(n) && n >= 1 ? n : null;
  };
  // No min<=max normalisation here: the bar surfaces swapped values and the
  // Apply handler rejects them, so the user sees their own mistake.
  const appsMin = posInt("appsMin");
  const appsMax = posInt("appsMax");
  return {
    boroughs: str("borough")?.split(",").filter(Boolean) ?? [],
    filedFrom: str("filedFrom"),
    filedTo: str("filedTo"),
    // "updatedFrom=any" lets the user clear the default 3-month window.
    updatedFrom: updatedFrom === "any" ? null : (updatedFrom ?? d.updatedFrom),
    updatedTo: str("updatedTo"),
    rootStatus: (str("rootStatus")?.split(",") ?? []).filter((s): s is RootStatusGroup =>
      ROOT_STATUS_GROUPS.includes(s as RootStatusGroup)
    ),
    practice: PRACTICE_STATUSES.includes(str("practice") as PracticeStatus)
      ? (str("practice") as PracticeStatus)
      : null,
    q: str("q"),
    desc: str("desc"),
    appsMin,
    appsMax,
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
  if (f.practice) p.set("practice", f.practice);
  if (f.q) p.set("q", f.q);
  if (f.desc) p.set("desc", f.desc);
  if (f.appsMin != null) p.set("appsMin", String(f.appsMin));
  if (f.appsMax != null) p.set("appsMax", String(f.appsMax));
  if (f.starred) p.set("starred", "1");
  if (f.sort !== d.sort) p.set("sort", f.sort);
  if (f.dir !== d.dir) p.set("dir", f.dir);
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}
