"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LeadFilters } from "@/lib/filters";
import { filtersToParams } from "@/lib/filters";
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

const SIZES = ["Small", "Medium", "Large"];
const STATES = ["Permitted", "Conditions"];

export function LeadsFilters({
  filters,
  boroughs,
}: {
  filters: LeadFilters;
  boroughs: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(filters.q ?? "");
  const [agent, setAgent] = useState(filters.agent ?? "");
  const [from, setFrom] = useState(filters.decidedFrom ?? "");
  const [to, setTo] = useState(filters.decidedTo ?? "");
  const [appType, setAppType] = useState(filters.appType ?? "");
  const [boroughSel, setBoroughSel] = useState<string[]>(filters.boroughs);
  const [stateSel, setStateSel] = useState<string[]>(filters.states);
  const [sizeSel, setSizeSel] = useState<string[]>(filters.sizes);
  const [hasAgent, setHasAgent] = useState(filters.hasAgent);
  const [notContacted, setNotContacted] = useState(filters.notContacted);
  const [starred, setStarred] = useState(filters.starred);

  function apply(overrides: Partial<LeadFilters> = {}) {
    const next: LeadFilters = {
      ...filters,
      q: q || null,
      agent: agent || null,
      decidedFrom: from || null,
      decidedTo: to || null,
      appType: appType || null,
      boroughs: boroughSel,
      states: stateSel,
      sizes: sizeSel,
      hasAgent,
      notContacted,
      starred,
      page: 1,
      ...overrides,
    };
    router.push(`/?${filtersToParams(next).toString()}`);
  }

  function toggle(list: string[], v: string, set: (x: string[]) => void) {
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
          placeholder="description, address, postcode"
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
        <Label className="text-xs">Size</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              {sizeSel.length ? sizeSel.join(", ") : "Any"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {SIZES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={sizeSel.includes(s)}
                onCheckedChange={() => toggle(sizeSel, s, setSizeSel)}
                onSelect={(e) => e.preventDefault()}
              >
                {s}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">State</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              {stateSel.length ? stateSel.join(", ") : "Both"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {STATES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={stateSel.includes(s)}
                onCheckedChange={() => toggle(stateSel, s, setStateSel)}
                onSelect={(e) => e.preventDefault()}
              >
                {s}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Decided from</Label>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-8"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">to</Label>
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-8"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">App type</Label>
        <Input
          value={appType}
          onChange={(e) => setAppType(e.target.value)}
          placeholder="e.g. Full"
          className="h-8 w-28"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Agent / company</Label>
        <Input
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          placeholder="name contains…"
          className="h-8 w-40"
        />
      </div>

      <div className="flex items-center gap-4 pb-1">
        <label className="flex items-center gap-1.5 text-xs">
          <Checkbox
            checked={hasAgent}
            onCheckedChange={(v) => setHasAgent(v === true)}
          />
          Has agent
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <Checkbox
            checked={notContacted}
            onCheckedChange={(v) => setNotContacted(v === true)}
          />
          Not yet contacted
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <Checkbox
            checked={starred}
            onCheckedChange={(v) => setStarred(v === true)}
          />
          Starred
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
