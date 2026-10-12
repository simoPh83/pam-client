"use client";

import { useTransition } from "react";
import { applyGroupingResolution } from "@/lib/actions";
import { useToast } from "@/components/ui/toaster";
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
  const toast = useToast();

  function apply() {
    startTransition(async () => {
      const result = await applyGroupingResolution(reviewId, resolution);
      if (result.ok) {
        toast({ variant: "success", title: label });
      } else {
        toast({
          variant: "destructive",
          title: "Could not update grouping",
          description: result.error,
        });
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      disabled={pending}
      onClick={apply}
    >
      {pending ? "Saving…" : label}
    </Button>
  );
}
