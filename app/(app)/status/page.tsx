import { formatDistanceToNow } from "date-fns";
import { formatDateTime } from "@/lib/dates";
import { getJobsSummary } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const { lastSyncByArea, queue, recentFailed } = await getJobsSummary();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Data freshness</h1>

      <div className="flex gap-3">
        {queue.map((q) => (
          <div key={q.status} className="rounded-md border px-4 py-2 text-sm">
            <span className="text-muted-foreground">{q.status}: </span>
            <strong>{q.count}</strong>
          </div>
        ))}
        {queue.length === 0 && (
          <div className="rounded-md border px-4 py-2 text-sm">
            Job queue empty
          </div>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Last successful sync per borough
        </h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Borough</TableHead>
                <TableHead>Last done</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lastSyncByArea.map((a) => (
                <TableRow key={a.area}>
                  <TableCell>{a.area}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.finished_at
                      ? `${formatDateTime(a.finished_at)} (${formatDistanceToNow(new Date(a.finished_at), { addSuffix: true })})`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {recentFailed.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-destructive">
            Recent failed jobs
          </h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Area</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Finished</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentFailed.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell>{j.area}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{j.kind}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatDateTime(j.finished_at)}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {j.error}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
