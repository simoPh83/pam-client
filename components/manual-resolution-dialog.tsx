"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  applyGroupingResolution,
  getSameAddressSchemesAction,
  getSamePostcodeSchemesAction,
  resolveReviewSingleton,
  resolveReviewWithRef,
} from "@/lib/actions";
import { normaliseManualRef, validateManualRef } from "@/lib/manual-ref";
import { formatDate } from "@/lib/dates";
import type { SchemeCandidate } from "@/lib/types";
import { useToast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Mode = "ref" | "noref";
type Scope = "address" | "postcode";

type Props = {
  reviewId: number;
  uid: string;
  authority: string;
  addressKey: string | null;
  reference: string | null;
  description: string | null;
  label?: string;
};

function SchemeCard({
  scheme,
  disabled,
  onAssign,
}: {
  scheme: SchemeCandidate;
  disabled: boolean;
  onAssign: () => void;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-background/70 p-3">
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-xs text-muted-foreground">
          Scheme #{scheme.project_id}
          {scheme.app_type ? ` · ${scheme.app_type}` : ""} ·{" "}
          {scheme.n_applications} application
          {scheme.n_applications === 1 ? "" : "s"}
        </p>
        {scheme.address && <p className="mt-0.5 text-xs">{scheme.address}</p>}
        {scheme.description && (
          <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">
            {scheme.description}
          </p>
        )}
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Filed {formatDate(scheme.start_date)} · Decided{" "}
          {formatDate(scheme.decided_date)}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={onAssign}
      >
        Assign to this scheme
      </Button>
    </li>
  );
}

export function ManualResolutionDialog({
  reviewId,
  uid,
  authority,
  addressKey,
  reference,
  description,
  label = "Resolve manually",
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("ref");
  const [refInput, setRefInput] = useState("");
  const [message, setMessage] = useState<{
    kind: "error" | "warning";
    text: string;
  } | null>(null);
  const [scope, setScope] = useState<Scope>("address");
  const [addressSchemes, setAddressSchemes] = useState<SchemeCandidate[] | null>(
    null
  );
  const [postcodeSchemes, setPostcodeSchemes] = useState<SchemeCandidate[]>([]);
  const [postcodePage, setPostcodePage] = useState(0);
  const [postcodeMore, setPostcodeMore] = useState(false);
  const [pending, startTransition] = useTransition();

  function close(refresh: boolean) {
    setOpen(false);
    if (refresh) router.refresh();
  }

  function loadPostcodePage(page: number) {
    startTransition(async () => {
      const res = await getSamePostcodeSchemesAction(uid, page);
      if (!res.ok) {
        setMessage({ kind: "error", text: res.error });
        return;
      }
      setPostcodeSchemes((prev) => {
        const seen = new Set(prev.map((s) => s.project_id));
        const fresh = res.data.schemes.filter((s) => !seen.has(s.project_id));
        return page === 1 ? res.data.schemes : [...prev, ...fresh];
      });
      setPostcodePage(page);
      setPostcodeMore(res.data.hasMore);
    });
  }

  useEffect(() => {
    if (!open || mode !== "noref" || addressSchemes) return;
    startTransition(async () => {
      const res = await getSameAddressSchemesAction(authority, addressKey);
      if (res.ok) setAddressSchemes(res.data);
      else setMessage({ kind: "error", text: res.error });
    });
  }, [open, mode, addressSchemes, authority, addressKey]);

  useEffect(() => {
    if (open && mode === "noref" && scope === "postcode" && postcodePage === 0) {
      loadPostcodePage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, scope, postcodePage]);

  function submitRef() {
    setMessage(null);
    const ref = normaliseManualRef(refInput);
    const invalid = validateManualRef(ref);
    if (invalid) {
      setMessage({ kind: "error", text: invalid });
      return;
    }
    startTransition(async () => {
      const res = await resolveReviewWithRef(reviewId, ref);
      if (!res.ok) {
        setMessage({ kind: "error", text: res.error });
        if (/not pending/i.test(res.error)) router.refresh();
        return;
      }
      const { outcome } = res;
      if (outcome.action === "exhausted") {
        setMessage({
          kind: "warning",
          text: "PlanIt has no record of this reference (already looked up). Check the ref, or choose another option.",
        });
        return;
      }
      if (outcome.action === "linked") {
        toast({
          variant: "success",
          title: "Linked to scheme",
          description: `Reference ${outcome.reference ?? ref} matched — the application was moved into its scheme.`,
        });
        if (outcome.project_id) {
          router.push(`/lead?uid=${encodeURIComponent(uid)}`);
        }
      } else {
        toast({
          variant: "info",
          title: "Reference saved",
          description:
            "The next parent hunt will fetch it and link automatically.",
        });
      }
      close(true);
    });
  }

  function assign(projectId: number) {
    setMessage(null);
    startTransition(async () => {
      const res = await applyGroupingResolution(reviewId, String(projectId));
      if (!res.ok) {
        setMessage({ kind: "error", text: res.error });
        if (/not pending/i.test(res.error)) router.refresh();
        return;
      }
      toast({
        variant: "success",
        title: "Assigned to scheme",
        description: `Application assigned to scheme #${projectId}.`,
      });
      close(true);
    });
  }

  function singleton() {
    setMessage(null);
    startTransition(async () => {
      const res = await resolveReviewSingleton(reviewId);
      if (!res.ok) {
        setMessage({ kind: "error", text: res.error });
        if (/not pending/i.test(res.error)) router.refresh();
        return;
      }
      toast({
        variant: "success",
        title: "Standalone scheme created",
        description: "The application now forms its own scheme.",
      });
      if (res.projectId) router.push(`/lead?uid=${encodeURIComponent(uid)}`);
      close(true);
    });
  }

  function dismiss() {
    setMessage(null);
    startTransition(async () => {
      const res = await applyGroupingResolution(reviewId, "dismiss");
      if (!res.ok) {
        setMessage({ kind: "error", text: res.error });
        return;
      }
      toast({ variant: "default", title: "Dismissed" });
      close(true);
    });
  }

  const schemes = scope === "address" ? addressSchemes : postcodeSchemes;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setMessage(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="secondary">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resolve application manually</DialogTitle>
          <DialogDescription>
            {reference ?? uid} · {authority}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "ref" ? "default" : "outline"}
            onClick={() => setMode("ref")}
          >
            Paste a reference
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "noref" ? "default" : "outline"}
            onClick={() => setMode("noref")}
          >
            No reference available
          </Button>
        </div>

        {mode === "ref" ? (
          <div className="space-y-3">
            {description && (
              <p className="max-h-40 overflow-y-auto rounded-md border bg-muted/30 p-2 text-sm whitespace-pre-wrap">
                {description}
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor={`manual-ref-${reviewId}`}>Parent reference</Label>
              <Input
                id={`manual-ref-${reviewId}`}
                value={refInput}
                placeholder="e.g. 25/AP/0349"
                onChange={(e) => setRefInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !pending) submitRef();
                }}
              />
            </div>
            <Button
              type="button"
              disabled={pending || !refInput.trim()}
              onClick={submitRef}
            >
              {pending ? "Saving…" : "Save reference"}
            </Button>
            <p className="text-xs text-muted-foreground">
              If the parent isn&apos;t stored yet, the reference is saved and the
              next parent hunt will fetch and link it automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={scope === "address" ? "secondary" : "ghost"}
                onClick={() => setScope("address")}
              >
                Same address
              </Button>
              <Button
                type="button"
                size="sm"
                variant={scope === "postcode" ? "secondary" : "ghost"}
                onClick={() => setScope("postcode")}
              >
                Same postcode
              </Button>
            </div>
            {schemes === null || (scope === "postcode" && postcodePage === 0) ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : schemes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No schemes found{scope === "address" ? " at this address" : " at this postcode"}.
              </p>
            ) : (
              <ul className="space-y-2">
                {schemes.map((s) => (
                  <SchemeCard
                    key={s.project_id}
                    scheme={s}
                    disabled={pending}
                    onAssign={() => assign(s.project_id)}
                  />
                ))}
              </ul>
            )}
            {scope === "postcode" && postcodeMore && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => loadPostcodePage(postcodePage + 1)}
              >
                Load more
              </Button>
            )}
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={singleton}
              >
                Make it a standalone scheme
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={dismiss}
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {message && (
          <p
            role="alert"
            className={
              message.kind === "error"
                ? "text-xs text-destructive"
                : "text-xs text-amber-700 dark:text-amber-400"
            }
          >
            {message.text}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
