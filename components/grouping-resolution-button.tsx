"use client";

import { useState, useTransition } from "react";
import { applyGroupingResolution } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function GroupingResolutionButton({
  reviewId,
  resolution,
  label,
  variant = "outline",
}: {
  reviewId: number;
  resolution: string;
  label: string;
  variant?: "outline" | "secondary";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function apply() {
    setError(null);
    startTransition(async () => {
      const result = await applyGroupingResolution(reviewId, resolution);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant={variant}
        disabled={pending}
        onClick={apply}
      >
        {pending ? "Saving…" : label}
      </Button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          Could not update grouping: {error}
        </p>
      )}
    </div>
  );
}
