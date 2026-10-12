"use client";

import { useState, useTransition } from "react";
import { applyGroupingResolution } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * "Split into separate schemes" action for a multi-root review. The split is
 * performed by the worker (queued via the RPC), not synchronously — on
 * `split_queued` the parent shows the in-flight state (see
 * docs/2026-10-12-split-wiring-frontend.md).
 */
export function SplitSchemeButton({
  reviewId,
  candidateCount,
  onQueued,
}: {
  reviewId: number;
  candidateCount: number;
  onQueued: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function apply() {
    setError(null);
    startTransition(async () => {
      const result = await applyGroupingResolution(reviewId, "split");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      if (result.action === "split_queued") onQueued();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Split into separate schemes
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Split into separate schemes?</DialogTitle>
          <DialogDescription>
            Each of the {candidateCount} candidate schemes — and the
            applications linked to it — becomes its own project. The split is
            queued and usually completes within a minute; stars, notes and
            practice assignments stay with the current project.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="text-xs text-destructive" role="alert">
            Could not request the split: {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={apply}>
            {pending ? "Requesting…" : "Request split"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
