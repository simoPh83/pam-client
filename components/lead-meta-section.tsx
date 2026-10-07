"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleProjectStar, updateProjectMeta } from "@/lib/actions";
import type { ProjectMeta } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function LeadMetaSection({
  projectId,
  meta,
}: {
  projectId: number;
  meta: ProjectMeta | null;
}) {
  const [starred, setStarred] = useState(meta?.starred ?? false);
  const [hidden, setHidden] = useState(meta?.hidden ?? false);
  const [notes, setNotes] = useState(meta?.notes ?? "");
  const [pending, startTransition] = useTransition();

  function toggleStar() {
    const v = !starred;
    setStarred(v);
    startTransition(() => toggleProjectStar(projectId, v));
  }

  function toggleHidden() {
    const v = !hidden;
    setHidden(v);
    startTransition(() => updateProjectMeta(projectId, { hidden: v }));
  }

  function saveNotes() {
    startTransition(() => updateProjectMeta(projectId, { notes }));
  }

  return (
    <div className="rounded-md border p-4">
      <h2 className="mb-3 text-sm font-semibold">Your flags</h2>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleStar}
          disabled={pending}
          className={cn(starred && "border-yellow-400")}
        >
          <Star
            className={cn(
              "size-4",
              starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
            )}
          />
          {starred ? "Starred" : "Star"}
        </Button>
        <Button variant="outline" size="sm" onClick={toggleHidden} disabled={pending}>
          {hidden ? "Unhide" : "Hide"}
        </Button>
      </div>
      <div className="mt-3 space-y-1">
        <Label className="text-xs">Private notes</Label>
        <Textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. called 12 Oct, speak to Dana…"
        />
        <Button
          size="sm"
          variant="secondary"
          className="mt-1"
          onClick={saveNotes}
          disabled={pending}
        >
          Save notes
        </Button>
      </div>
    </div>
  );
}
