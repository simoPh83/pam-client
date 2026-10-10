import { Suspense } from "react";
import {
  getBoroughs,
  getProjectsFeed,
  getUnlinkedNoSchemeReviews,
  PAGE_SIZE,
} from "@/lib/queries";
import {
  parseProjectFilters,
  projectFiltersToParams,
} from "@/lib/project-filters";
import { ProjectsFilters } from "@/components/projects-filters";
import { ProjectsTable } from "@/components/projects-table";
import { Pagination } from "@/components/pagination";
import { UnlinkedNoSchemeList } from "@/components/unlinked-no-scheme-list";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseProjectFilters(params);
  const orphanPage = Math.max(
    1,
    Number.parseInt(
      typeof params.orphanPage === "string" ? params.orphanPage : "1",
      10
    ) || 1
  );
  const [
    boroughs,
    { rows, total },
    { rows: unlinkedRows, total: unlinkedTotal },
  ] = await Promise.all([
    getBoroughs(),
    getProjectsFeed(filters),
    getUnlinkedNoSchemeReviews(orphanPage),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const unlinkedPageCount = Math.max(
    1,
    Math.ceil(unlinkedTotal / PAGE_SIZE)
  );
  const makeUnlinkedHref = (page: number) => {
    const query = projectFiltersToParams(filters);
    if (page > 1) query.set("orphanPage", String(page));
    return `/?${query.toString()}`;
  };

  return (
    <div className="space-y-3">
      <Suspense>
        <ProjectsFilters filters={filters} boroughs={boroughs} />
      </Suspense>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          <p>
            {total.toLocaleString()} projects
            {filters.updatedFrom ? ` · updated since ${filters.updatedFrom}` : ""}
          </p>
          <p className="text-xs">
            A project represents one scheme, not one address; the same address
            can therefore appear in multiple projects.
          </p>
        </div>
        <Pagination
          page={filters.page}
          pageCount={pageCount}
          makeHref={(p) =>
            `/?${projectFiltersToParams({ ...filters, page: p }).toString()}`
          }
        />
      </div>

      <ProjectsTable rows={rows} filters={filters} />

      <UnlinkedNoSchemeList
        rows={unlinkedRows}
        total={unlinkedTotal}
        page={orphanPage}
        pageCount={unlinkedPageCount}
        makeHref={makeUnlinkedHref}
      />
    </div>
  );
}
