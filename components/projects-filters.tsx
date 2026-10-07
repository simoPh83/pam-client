"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProjectFilters, RootStatusGroup } from "@/lib/project-filters";
import { projectFiltersToParams } from "@/lib/project-filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROOT_STATUS_OPTIONS: { value: RootStatusGroup; label: string }[] = [
  { value: "approved", label: "Approved" },
  { value: "not_approved", label: "Not approved" },
  { value: "pending", label: "Pending" },
  { value: "other", label: "Other / unknown" },
];

export function ProjectsFilters({
  filters,
  boroughs,
}: {
  filters: ProjectFilters;
  boroughs: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(filters.q ?? "");
  const [filedFrom, setFiledFrom] = useState(filters.filedFrom ?? "");
  const [filedTo, setFiledTo] = useState(filters.filedTo ?? "");
  const [updatedFrom, setUpdatedFrom] = useState(filters.updatedFrom ?? "");
  const [updatedTo, setUpdatedTo] = useState(filters.updatedTo ?? "");
  const [boroughSel, setBoroughSel] = useState<string[]>(filters.boroughs);
  const [statusSel, setStatusSel] = useState<RootStatusGroup[]>(filters.rootStatus);
  const [starred, setStarred] = useState(filters.starred);

  function apply(overrides: Partial<ProjectFilters> = {}) {
    const next: ProjectFilters = {
      ...filters,
      q: q || null,
      filedFrom: filedFrom || null,
      filedTo: filedTo || null,
      updatedFrom: updatedFrom || null,
      updatedTo: updatedTo || null,
      boroughs: boroughSel,
      rootStatus: statusSel,
      starred,
      page: 1,
      ...overrides,
    };
    router.push(`/?${projectFiltersToParams(next).toString()}`);
  }

  function toggle<T>(list: T[], v: T, set: (x: T[]) => void) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-md border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <div className="space-y-1">
        <Label className="text-xs">Search</Label>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="project name / address"
          className="h-8 w-56"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Borough</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              {boroughSel.length ? `${boroughSel.length} selected` : "All"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-80 overflow-auto">
            {boroughs.map((b) => (
              <DropdownMenuCheckboxItem
                key={b}
                checked={boroughSel.includes(b)}
                onCheckedChange={() => toggle(boroughSel, b, setBoroughSel)}
                onSelect={(e) => e.preventDefault()}
              >
                {b}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Root status</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              {statusSel.length
                ? statusSel
                    .map((s) => ROOT_STATUS_OPTIONS.find((o) => o.value === s)?.label)
                    .join(", ")
                : "Any"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {ROOT_STATUS_OPTIONS.map((o) => (
              <DropdownMenuCheckboxItem
                key={o.value}
                checked={statusSel.includes(o.value)}
                onCheckedChange={() => toggle(statusSel, o.value, setStatusSel)}
                onSelect={(e) => e.preventDefault()}
              >
                {o.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Filed from</Label>
        <Input
          type="date"
          value={filedFrom}
          onChange={(e) => setFiledFrom(e.target.value)}
          className="h-8"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">to</Label>
        <Input
          type="date"
          value={filedTo}
          onChange={(e) => setFiledTo(e.target.value)}
          className="h-8"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Updated from</Label>
        <Input
          type="date"
          value={updatedFrom}
          onChange={(e) => setUpdatedFrom(e.target.value)}
          className="h-8"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">to</Label>
        <Input
          type="date"
          value={updatedTo}
          onChange={(e) => setUpdatedTo(e.target.value)}
          className="h-8"
        />
      </div>

      <div className="flex items-center gap-4 pb-1">
        <label className="flex items-center gap-1.5 text-xs">
          <Checkbox
            checked={starred}
            onCheckedChange={(v) => setStarred(v === true)}
          />
          Starred by me
        </label>
      </div>

      <Button type="submit" size="sm" className="h-8">
        Apply
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8"
        onClick={() => router.push("/")}
      >
        Reset
      </Button>
    </form>
  );
}
