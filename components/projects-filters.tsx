"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProjectFilters, RootStatusGroup } from "@/lib/project-filters";
import { defaultProjectFilters, projectFiltersToParams } from "@/lib/project-filters";
import type { PracticeStatus } from "@/lib/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROOT_STATUS_OPTIONS: { value: RootStatusGroup; label: string }[] = [
  { value: "approved", label: "Approved" },
  { value: "not_approved", label: "Not approved" },
  { value: "pending", label: "Pending" },
  { value: "other", label: "Other / unknown" },
];

const PRACTICE_OPTIONS: { value: PracticeStatus; label: string }[] = [
  { value: "none", label: "none" },
  { value: "agent", label: "by application" },
  { value: "assigned", label: "by user" },
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
  const [desc, setDesc] = useState(filters.desc ?? "");
  const [filedFrom, setFiledFrom] = useState(filters.filedFrom ?? "");
  const [filedTo, setFiledTo] = useState(filters.filedTo ?? "");
  const [updatedFrom, setUpdatedFrom] = useState(filters.updatedFrom ?? "");
  const [updatedTo, setUpdatedTo] = useState(filters.updatedTo ?? "");
  const [boroughSel, setBoroughSel] = useState<string[]>(filters.boroughs);
  const [statusSel, setStatusSel] = useState<RootStatusGroup[]>(filters.rootStatus);
  const [practiceSel, setPracticeSel] = useState<PracticeStatus | "any">(
    filters.practice ?? "any"
  );
  const [starred, setStarred] = useState(filters.starred);

  function apply(overrides: Partial<ProjectFilters> = {}) {
    const next: ProjectFilters = {
      ...filters,
      q: q || null,
      desc: desc || null,
      filedFrom: filedFrom || null,
      filedTo: filedTo || null,
      updatedFrom: updatedFrom || null,
      updatedTo: updatedTo || null,
      boroughs: boroughSel,
      rootStatus: statusSel,
      practice: practiceSel === "any" ? null : practiceSel,
      starred,
      page: 1,
      ...overrides,
    };
    router.push(`/?${projectFiltersToParams(next).toString()}`);
  }

  function reset() {
    const d = defaultProjectFilters();
    setQ("");
    setDesc("");
    setFiledFrom("");
    setFiledTo("");
    setUpdatedFrom(d.updatedFrom ?? "");
    setUpdatedTo("");
    setBoroughSel([]);
    setStatusSel([]);
    setPracticeSel("any");
    setStarred(false);
    router.push("/");
  }

  function toggle<T>(list: T[], v: T, set: (x: T[]) => void) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  return (
    <form
      className="space-y-3 rounded-md border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      {/* Row 1: free-text searches */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Project name</Label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="name / address"
            className="h-8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Description</Label>
          <Input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder='e.g. house OR villa -garden'
            className="h-8"
          />
        </div>
      </div>

      {/* Row 2: structured filters + actions */}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
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

      {/* flex-col instead of space-y: Radix adds a hidden native <select> sibling
          inside forms, which makes space-y add a stray bottom margin. */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Assigned Practice</Label>
        <Select
          value={practiceSel}
          onValueChange={(v) => setPracticeSel(v as PracticeStatus | "any")}
        >
          <SelectTrigger size="sm" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            {PRACTICE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      <div className="ml-auto flex gap-2">
        <Button type="submit" size="sm" className="h-8">
          Apply
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={reset}
        >
          Reset
        </Button>
      </div>
      </div>
    </form>
  );
}
