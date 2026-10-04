"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Star } from "lucide-react";
import type { Lead, LeadMeta } from "@/lib/types";
import type { LeadFilters } from "@/lib/filters";
import { filtersToParams } from "@/lib/filters";
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

function SortableHead({
  label,
  col,
  filters,
}: {
  label: string;
  col: "decided_date" | "authority" | "app_size" | "app_state";
  filters: LeadFilters;
}) {
  const router = useRouter();
  const active = filters.sort === col;
  const nextDir = active && filters.dir === "desc" ? "asc" : "desc";
  return (
    <button
      className="flex items-center gap-1 font-medium"
      onClick={() =>
        router.push(
          `/?${filtersToParams({ ...filters, sort: col, dir: nextDir, page: 1 })}`
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

export function LeadsTable({
  rows,
  filters,
  metaByUid,
}: {
  rows: Lead[];
  filters: LeadFilters;
  metaByUid: Record<string, LeadMeta>;
}) {
  const router = useRouter();

  const columns: ColumnDef<Lead>[] = [
    {
      id: "star",
      header: "",
      cell: ({ row }) =>
        metaByUid[row.original.uid]?.starred ? (
          <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
        ) : null,
      size: 24,
    },
    {
      accessorKey: "reference",
      header: "Reference",
      cell: ({ row }) => (
        <Link
          href={`/lead/${encodeURIComponent(row.original.uid)}`}
          className="font-mono text-xs hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.reference ?? row.original.uid}
        </Link>
      ),
    },
    {
      accessorKey: "authority",
      header: () => <SortableHead label="Borough" col="authority" filters={filters} />,
    },
    {
      accessorKey: "address",
      header: "Address",
      cell: ({ getValue }) => (
        <span className="line-clamp-1 max-w-64">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ getValue }) => (
        <span className="line-clamp-2 max-w-md text-muted-foreground">
          {getValue<string>()}
        </span>
      ),
    },
    {
      accessorKey: "app_size",
      header: () => <SortableHead label="Size" col="app_size" filters={filters} />,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v ? (
          <Badge variant={v === "Large" ? "default" : "secondary"}>{v}</Badge>
        ) : null;
      },
    },
    {
      accessorKey: "app_state",
      header: () => <SortableHead label="State" col="app_state" filters={filters} />,
      cell: ({ getValue }) => (
        <Badge
          variant="outline"
          className={cn(
            getValue<string>() === "Permitted" && "border-green-600 text-green-700 dark:text-green-400"
          )}
        >
          {getValue<string>()}
        </Badge>
      ),
    },
    {
      accessorKey: "decided_date",
      header: () => (
        <SortableHead label="Decided" col="decided_date" filters={filters} />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "agent_display",
      header: "Agent",
      cell: ({ getValue }) => (
        <span className="line-clamp-1 max-w-48">{getValue<string>()}</span>
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
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id} className="whitespace-nowrap">
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
                className="cursor-pointer"
                onClick={() =>
                  router.push(`/lead/${encodeURIComponent(row.original.uid)}`)
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-1.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No leads match these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
