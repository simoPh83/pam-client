import Link from "next/link";
import { getOutreach } from "@/lib/queries";
import { formatDate, formatDateTime } from "@/lib/dates";
import { OUTREACH_STATUSES } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const statusFilter = typeof sp.status === "string" ? sp.status : undefined;
  const { entries, leadsByUid } = await getOutreach(statusFilter);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-4 text-xl font-semibold">Outreach</h1>
        <Button variant={!statusFilter ? "default" : "outline"} size="sm" asChild>
          <Link href="/outreach">All</Link>
        </Button>
        {OUTREACH_STATUSES.map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href={`/outreach?status=${s}`}>{s.replace("_", " ")}</Link>
          </Button>
        ))}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Follow-up</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Contacted</TableHead>
              <TableHead>By</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length ? (
              entries.map((e) => {
                const lead = leadsByUid.get(e.uid);
                const overdue = e.follow_up_on && e.follow_up_on <= today;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">
                      {e.follow_up_on ? (
                        <span className={overdue ? "font-semibold text-red-600" : ""}>
                          {formatDate(e.follow_up_on)}
                          {overdue ? " !" : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {(e.status ?? "contacted").replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/lead?uid=${encodeURIComponent(e.uid)}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {lead?.reference ?? e.uid}
                      </Link>
                      {lead && (
                        <div className="text-xs text-muted-foreground">
                          {lead.authority}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {[e.to_name, e.to_email].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatDateTime(e.contacted_at)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.created_by_email}
                    </TableCell>
                    <TableCell className="max-w-64">
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {e.notes}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No outreach logged yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Sorted by follow-up date (due first), then most recent. Red = overdue.
      </p>
    </div>
  );
}
