import { Suspense } from "react";
import {
  getBoroughs,
  getLeads,
  parseFilters,
  filtersToParams,
  PAGE_SIZE,
} from "@/lib/queries";
import { LeadsFilters } from "@/components/leads-filters";
import { LeadsTable } from "@/components/leads-table";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const [boroughs, { rows, total, metaByUid }] = await Promise.all([
    getBoroughs(),
    getLeads(filters, { grouped: filters.grouped }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <Suspense>
        <LeadsFilters filters={filters} boroughs={boroughs} />
      </Suspense>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total.toLocaleString()} leads
          {filters.grouped ? " (grouped by project)" : ""}
          {filters.decidedFrom ? ` · decided since ${filters.decidedFrom}` : ""}
        </span>
        <Pagination
          page={filters.page}
          pageCount={pageCount}
          makeHref={(p) =>
            `/?${filtersToParams({ ...filters, page: p }).toString()}`
          }
        />
      </div>

      <LeadsTable
        rows={rows}
        filters={filters}
        metaByUid={Object.fromEntries(metaByUid)}
      />
    </div>
  );
}
