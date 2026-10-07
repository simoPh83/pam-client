import { Suspense } from "react";
import {
  getBoroughs,
  getProjectsFeed,
  PAGE_SIZE,
} from "@/lib/queries";
import {
  parseProjectFilters,
  projectFiltersToParams,
} from "@/lib/project-filters";
import { ProjectsFilters } from "@/components/projects-filters";
import { ProjectsTable } from "@/components/projects-table";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseProjectFilters(await searchParams);
  const [boroughs, { rows, total }] = await Promise.all([
    getBoroughs(),
    getProjectsFeed(filters),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <Suspense>
        <ProjectsFilters filters={filters} boroughs={boroughs} />
      </Suspense>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total.toLocaleString()} projects
          {filters.updatedFrom ? ` · updated since ${filters.updatedFrom}` : ""}
        </span>
        <Pagination
          page={filters.page}
          pageCount={pageCount}
          makeHref={(p) =>
            `/?${projectFiltersToParams({ ...filters, page: p }).toString()}`
          }
        />
      </div>

      <ProjectsTable rows={rows} filters={filters} />
    </div>
  );
}
