import Link from "next/link";
import type { UnlinkedNoSchemeRow } from "@/lib/types";
import { GroupingResolutionButton } from "@/components/grouping-resolution-button";
import { Pagination } from "@/components/pagination";

export function UnlinkedNoSchemeList({
  rows,
  total,
  page,
  pageCount,
  makeHref,
}: {
  rows: UnlinkedNoSchemeRow[];
  total: number;
  page: number;
  pageCount: number;
  makeHref: (page: number) => string;
}) {
  if (total === 0) return null;

  return (
    <details
      className="rounded-md border border-zinc-300 bg-zinc-50/70 p-3 dark:bg-zinc-900/30"
      open={page > 1}
    >
      <summary className="cursor-pointer select-none">
        <h2 className="inline text-sm font-semibold">No linked scheme</h2>
        <span className="ml-2 text-xs text-muted-foreground">
          {total.toLocaleString()} parentless application
          {total === 1 ? "" : "s"} at addresses with no known scheme. These are
          queue rows, not projects.
        </span>
      </summary>

      <div className="mt-2 flex justify-end">
        <Pagination page={page} pageCount={pageCount} makeHref={makeHref} />
      </div>

      <ul className="mt-2 space-y-1">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white/70 px-3 py-2 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-300"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <Link
                  href={`/lead?uid=${encodeURIComponent(row.uid)}`}
                  className="font-mono font-medium hover:underline"
                >
                  {row.reference ?? row.uid}
                </Link>
                {row.app_type && (
                  <span className="text-muted-foreground">{row.app_type}</span>
                )}
                <span className="text-muted-foreground">{row.authority}</span>
              </div>
              {row.address && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {row.address}
                </p>
              )}
              {row.description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {row.description}
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                No linked scheme — parent not yet in our data.
              </p>
            </div>
            <GroupingResolutionButton
              reviewId={row.id}
              resolution="dismiss"
              label="Dismiss"
            />
          </li>
        ))}
      </ul>

      <div className="mt-2 flex justify-end">
        <Pagination page={page} pageCount={pageCount} makeHref={makeHref} />
      </div>
    </details>
  );
}
