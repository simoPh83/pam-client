"use client";

import { useState, useTransition } from "react";
import { addOutreachEntry } from "@/lib/actions";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { OutreachEntry } from "@/lib/types";
import { OUTREACH_CHANNELS, OUTREACH_STATUSES } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_STYLE: Record<string, string> = {
  won: "border-green-600 text-green-700 dark:text-green-400",
  lost: "border-red-600 text-red-700 dark:text-red-400",
  replied: "border-blue-600 text-blue-700 dark:text-blue-400",
};

export function OutreachSection({
  uid,
  entries,
}: {
  uid: string;
  entries: OutreachEntry[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<string>("email");
  const [status, setStatus] = useState<string>("contacted");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      channel,
      to_name: (fd.get("to_name") as string) || null,
      to_email: (fd.get("to_email") as string) || null,
      status,
      follow_up_on: (fd.get("follow_up_on") as string) || null,
      notes: (fd.get("notes") as string) || null,
    };
    setError(null);
    startTransition(async () => {
      try {
        await addOutreachEntry(uid, input);
        (e.target as HTMLFormElement).reset();
        setChannel("email");
        setStatus("contacted");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <div className="rounded-md border p-4">
      <h2 className="mb-3 text-sm font-semibold">
        Outreach log{" "}
        <span className="font-normal text-muted-foreground">
          ({entries.length})
        </span>
      </h2>

      <form onSubmit={submit} className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Channel</Label>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTREACH_CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTREACH_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To (name)</Label>
          <Input name="to_name" className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To (email)</Label>
          <Input name="to_email" type="email" className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Follow up on</Label>
          <Input name="follow_up_on" type="date" className="h-8" />
        </div>
        <div className="col-span-2 space-y-1 md:col-span-3">
          <Label className="text-xs">Notes</Label>
          <Textarea name="notes" rows={2} />
        </div>
        <div className="col-span-2 flex items-end gap-2 md:col-span-4">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Log outreach"}
          </Button>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      </form>

      {entries.length > 0 && (
        <ol className="space-y-3">
          {entries.map((en) => (
            <li key={en.id} className="border-t pt-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={STATUS_STYLE[en.status ?? ""]}>
                  {(en.status ?? "contacted").replace("_", " ")}
                </Badge>
                {en.channel && (
                  <span className="text-xs text-muted-foreground">{en.channel}</span>
                )}
                <span className="font-mono text-xs text-muted-foreground">
                  {formatDateTime(en.contacted_at)}
                </span>
                {en.follow_up_on && (
                  <span className="text-xs">
                    follow-up {formatDate(en.follow_up_on)}
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {en.created_by_email ?? "unknown"}
                </span>
              </div>
              {(en.to_name || en.to_email) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  to {[en.to_name, en.to_email].filter(Boolean).join(" · ")}
                </p>
              )}
              {en.notes && <p className="mt-1 whitespace-pre-wrap">{en.notes}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
