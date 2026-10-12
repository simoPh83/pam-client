"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Building2, CircleAlert, File, FolderTree, Star, UserSearch } from "lucide-react";
import { toggleProjectStar } from "@/lib/actions";
import type { PracticeStatus, ProjectFeedRow } from "@/lib/types";
import type { ProjectFilters } from "@/lib/project-filters";
import { projectFiltersToParams } from "@/lib/project-filters";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ProjectRow = ProjectFeedRow & {
  missing_parent_status: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  original: "Original application",
  discharge: "Discharge of conditions",
  variation: "Variation (s73)",
  nma: "Non-material amendment",
};

function roleLabel(role: string | null): string {
  return (role && ROLE_LABELS[role]) ?? "Application";
}

/** Colour-coded raw app_state (grouped: approved/pending/rejected/other). */
function StateBadge({ state }: { state: string | null }) {
  if (!state) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge
      variant="outline"
      className={cn(
        (state === "Permitted" || state === "Conditions") &&
          "border-emerald-600 text-emerald-700 dark:text-emerald-400",
        state === "Undecided" &&
          "border-amber-500 text-amber-700 dark:text-amber-400",
        state === "Rejected" &&
          "border-rose-600 text-rose-700 dark:text-rose-400",
        (state === "Withdrawn" ||
          state === "Unresolved" ||
          state === "Referred") &&
          "border-zinc-500 text-zinc-600 dark:text-zinc-400"
      )}
    >
      {state}
    </Badge>
  );
}

/** Three-state project icon: root missing / root only / root + children. */
function ProjectStateIcon({ row }: { row: ProjectRow }) {
  if (row.root_in_db === false) {
    const hint =
      row.missing_parent_status === "exhausted"
        ? "Original application not found on PlanIt"
        : row.missing_parent_status === "found"
          ? "Original application found — being linked"
          : "Original application predates our records — being fetched";
    return (
      <span title={`Scheme root missing — ${hint}`}>
        <CircleAlert className="size-4 text-amber-500" />
      </span>
    );
  }
  if (row.n_applications > 1) {
    return (
      <span title={`Scheme — root application + ${row.n_applications - 1} more`}>
        <FolderTree className="size-4 text-emerald-600" />
      </span>
    );
  }
  return (
    <span title="Single-application scheme (no related applications yet)">
      <File className="size-4 text-zinc-400" />
    </span>
  );
}

/**
 * Three-state practice signal: none / PlanIt agent present (unverified) /
 * verified practice assigned (overrides agent).
 */
function PracticeStatusCell({ status }: { status: PracticeStatus }) {
  if (status === "assigned") {
    return (
      <span title="Practice assigned (verified)">
        <Building2 className="size-4 text-emerald-600" />
      </span>
    );
  }
  if (status === "agent") {
    return (
      <span title="PlanIt agent present — no verified practice assigned yet">
        <UserSearch className="size-4 text-amber-500" />
      </span>
    );
  }
  return (
    <span title="No practice signal">
      <Building2 className="size-4 text-muted-foreground/30" />
    </span>
  );
}

/** Star toggle: solid = starred by you, light blue = starred by others only. */
function StarCell({ row }: { row: ProjectRow }) {
  const [starred, setStarred] = useState(row.starred_by_me);
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      title={
        starred
          ? "Starred by you — click to unstar"
          : row.starred_by_others
            ? "Starred by a colleague — click to star"
            : "Star this project"
      }
      onClick={(e) => {
        e.stopPropagation();
        const v = !starred;
        setStarred(v);
        startTransition(() => toggleProjectStar(row.id, v));
      }}
    >
      <Star
        className={cn(
          "size-3.5",
          starred
            ? "fill-yellow-400 text-yellow-400"
            : row.starred_by_others
              ? "fill-sky-300 text-sky-400"
              : "text-muted-foreground/40"
        )}
      />
    </button>
  );
}

function SortableHead({
  label,
  col,
  filters,
}: {
  label: string;
  col: ProjectFilters["sort"];
  filters: ProjectFilters;
}) {
  const router = useRouter();
  const active = filters.sort === col;
  const nextDir = active && filters.dir === "desc" ? "asc" : "desc";
  return (
    <button
      className="flex items-center gap-1 font-medium"
      onClick={() =>
        router.push(
          `/?${projectFiltersToParams({ ...filters, sort: col, dir: nextDir, page: 1 })}`
        )
      }
    >
      {label}
      {active &&
        (filters.dir === "desc" ? (
          <ArrowDown className="size-3" />
        ) : (
          <ArrowUp className="size-3" />
        ))}
    </button>
  );
}

export function ProjectsTable({
  rows,
  filters,
}: {
  rows: ProjectRow[];
  filters: ProjectFilters;
}) {
  const router = useRouter();

  const columns: ColumnDef<ProjectRow>[] = [
    {
      id: "state",
      header: "",
      size: 28,
      cell: ({ row }) => <ProjectStateIcon row={row.original} />,
    },
    {
      id: "star",
      header: "",
      size: 28,
      cell: ({ row }) => <StarCell row={row.original} />,
    },
    {
      id: "practice",
      header: "",
      size: 28,
      cell: ({ row }) => <PracticeStatusCell status={row.original.practice_status} />,
    },
    {
      accessorKey: "name",
      header: () => <SortableHead label="Project" col="name" filters={filters} />,
      size: 230,
      cell: ({ row }) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium" title={row.original.name ?? ""}>
              {row.original.name ?? "—"}
            </span>
            <span className="block text-[11px] text-muted-foreground">
              {row.original.authority}
            </span>
          </span>
          {row.original.grouping_state === "ambiguous" && (
            <Badge
              variant="outline"
              className="shrink-0 border-amber-500 text-amber-700 dark:text-amber-300"
            >
              Multiple schemes
            </Badge>
          )}
          {row.original.grouping_state === "provisional" && (
            <Badge variant="secondary" className="shrink-0">
              Incomplete chain
            </Badge>
          )}
          {row.original.unlinked_application_count > 0 && (
            <Badge
              variant="outline"
              className="shrink-0 text-muted-foreground"
              title="Parentless follow-ups at this address that can be assigned to a scheme"
            >
              {row.original.unlinked_application_count} unlinked application
              {row.original.unlinked_application_count === 1 ? "" : "s"}
            </Badge>
          )}
        </span>
      ),
    },
    {
      id: "apps",
      header: () => <span title="Applications in this scheme">Apps</span>,
      size: 46,
      cell: ({ row }) =>
        row.original.n_applications > 1 ? (
          <span className="flex justify-center">
            <Badge
              variant="secondary"
              className="size-5 justify-center rounded-full p-0 text-[10px]"
              title={`${row.original.n_applications} applications in this scheme`}
            >
              {row.original.n_applications}
            </Badge>
          </span>
        ) : null,
    },
    {
      accessorKey: "root_reference",
      header: "Root ref",
      size: 110,
      cell: ({ row }) =>
        row.original.root_uid ? (
          <Link
            href={`/lead?uid=${encodeURIComponent(row.original.root_uid)}`}
            className="font-mono text-xs hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.root_reference ?? row.original.root_uid}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "root_description",
      header: "Description",
      size: 380,
      // Full text, wrapping — rows vary in height by design.
      cell: ({ getValue }) => (
        <span className="block text-sm text-muted-foreground">
          {getValue<string>() ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "filed_date",
      // Not sortable: filed_date comes from the joined root application, so
      // sorting forces a full 160k-row join (~35s). Needs a worker-side
      // projects.filed_date column before we can offer it.
      header: "Filed",
      size: 82,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{formatDate(getValue<string>())}</span>
      ),
    },
    {
      accessorKey: "root_state",
      header: "Root status",
      size: 100,
      cell: ({ row }) =>
        row.original.root_in_db === false ? (
          <span className="text-xs text-muted-foreground" title="Root application not in our records">
            unknown
          </span>
        ) : (
          <StateBadge state={row.original.root_state} />
        ),
    },
    {
      accessorKey: "last_updated",
      header: () => (
        <SortableHead label="Last update" col="last_updated" filters={filters} />
      ),
      size: 90,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{formatDate(getValue<string>())}</span>
      ),
    },
    {
      id: "latest_activity",
      header: "Latest activity",
      size: 130,
      cell: ({ row }) =>
        row.original.latest_reference ? (
          <span className="flex flex-col items-start gap-0.5">
            <span
              className="text-xs text-muted-foreground"
              title={roleLabel(row.original.latest_role)}
            >
              {roleLabel(row.original.latest_role)}
            </span>
            <StateBadge state={row.original.latest_state} />
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  });

  return (
    <div className="rounded-md border">
      <Table className="table-fixed">
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead
                  key={h.id}
                  className="whitespace-nowrap"
                  style={
                    h.column.getSize() !== 150
                      ? { width: h.column.getSize() }
                      : undefined
                  }
                >
                  {h.isPlaceholder
                    ? null
                    : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  row.original.root_uid && "cursor-pointer"
                )}
                onClick={() => {
                  if (row.original.root_uid)
                    router.push(
                      `/lead?uid=${encodeURIComponent(row.original.root_uid)}`
                    );
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className="overflow-hidden whitespace-normal py-1.5"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No projects match these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
