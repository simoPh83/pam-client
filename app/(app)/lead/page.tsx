import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getLeadDetail,
  getProjectAgents,
  getProjectBundle,
  getProjectPractices,
} from "@/lib/queries";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { OutreachSection } from "@/components/outreach-section";
import { LeadMetaSection } from "@/components/lead-meta-section";
import { PracticesSection } from "@/components/practices-section";
import { ProjectAgents } from "@/components/project-agents";
import { ProjectTabs } from "@/components/project-tabs";

// Always re-query Supabase per request — the page reads live project/outreach
// data that changes between deploys and syncs.
export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export default async function LeadDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string }>;
}) {
  // uids contain slashes (e.g. "Haringey/HGY/2026/1830") which Turbopack dev
  // mode doesn't reliably remap to catch-all routes; use a query param instead.
  const { uid } = await searchParams;
  if (!uid) notFound();
  const { app, history, outreach, meta, otherByAgent } = await getLeadDetail(uid);
  if (!app) notFound();

  const { project, members } = app.project_id
    ? await getProjectBundle(Number(app.project_id))
    : { project: null, members: [] };

  // Project-level data (persistent across application tabs): shared practice
  // assignments and the read-only aggregation of PlanIt agents.
  const projectId = app.project_id != null ? Number(app.project_id) : null;
  const [assignments, agents] =
    projectId != null
      ? await Promise.all([
          getProjectPractices(projectId),
          getProjectAgents(projectId),
        ])
      : [[], []];

  const links = [
    { label: "Council page", url: app.council_url },
    { label: "Documents", url: app.docs_url },
    { label: "Comments", url: app.comment_url },
    { label: "PlanIt", url: app.source_url },
    {
      label: "Map",
      url:
        app.map_url ??
        (app.lat && app.lng
          ? `https://www.google.com/maps?q=${app.lat},${app.lng}`
          : null),
    },
  ].filter((l) => l.url);

  return (
    <div className="space-y-6">
      <ProjectTabs
        members={members}
        currentUid={uid}
        projectName={project?.name ?? null}
      />
      {projectId != null && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PracticesSection projectId={projectId} assignments={assignments} />
          <ProjectAgents agents={agents} />
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {app.reference ?? app.uid}{" "}
            <Badge variant="outline">{app.app_state}</Badge>{" "}
            {app.app_size && <Badge variant="secondary">{app.app_size}</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {app.address}
            {app.postcode ? ` · ${app.postcode}` : ""} · {app.authority}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.url!}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
            >
              {l.label} ↗
            </a>
          ))}
        </div>
      </div>

      {app.description && (
        <p className="max-w-4xl whitespace-pre-wrap text-sm">{app.description}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="rounded-md border p-4">
            <h2 className="mb-3 text-sm font-semibold">Application</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
              <Field label="Type" value={app.app_type} />
              <Field label="Application type" value={app.application_type} />
              <Field label="Development" value={app.development_type} />
              <Field label="Decision" value={app.decision} />
              <Field label="Decided by" value={app.decided_by} />
              <Field label="Decided" value={formatDate(app.decided_date)} />
              <Field label="Decision issued" value={formatDate(app.decision_issued_date)} />
              <Field label="Received" value={formatDate(app.date_received)} />
              <Field label="Validated" value={formatDate(app.date_validated)} />
              <Field label="Target decision" value={formatDate(app.target_decision_date)} />
              <Field label="Consultation ends" value={formatDate(app.consultation_end_date)} />
              <Field label="Permission expires" value={formatDate(app.permission_expires)} />
              <Field label="Ward" value={app.ward} />
              <Field label="Dwellings" value={app.n_dwellings} />
              <Field label="Documents" value={app.n_documents} />
              <Field label="Comments" value={app.n_comments} />
              <Field label="Constraints" value={app.n_constraints} />
              <Field label="UPRN" value={app.uprn} />
              <Field label="First seen" value={formatDate(app.first_seen)} />
              <Field label="Last updated" value={formatDate(app.last_updated)} />
              <Field label="Applicant" value={app.applicant_name} />
            </dl>
          </div>

          <div className="rounded-md border p-4">
            <h2 className="mb-3 text-sm font-semibold">State history</h2>
            {history.length ? (
              <ol className="space-y-2 text-sm">
                {history.map((h) => (
                  <li key={h.id} className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatDate(h.observed_at?.slice(0, 10))}
                    </span>
                    <span>
                      {h.old_state ?? "∅"} → <strong>{h.new_state}</strong>
                    </span>
                    {h.decision && (
                      <span className="text-muted-foreground">({h.decision})</span>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                No state changes observed yet.
              </p>
            )}
          </div>

          <OutreachSection uid={uid} entries={outreach} />
        </section>

        <aside className="space-y-4">
          <div className="rounded-md border p-4">
            <h2 className="mb-3 text-sm font-semibold">Agent</h2>
            <dl className="space-y-2">
              <Field label="Company" value={app.agent_company} />
              <Field label="Person" value={app.agent_name} />
              <Field label="Address" value={app.agent_address} />
            </dl>
            {otherByAgent.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                  Other leads by {app.agent_display}
                </h3>
                <ul className="space-y-1 text-sm">
                  {otherByAgent.map((l) => (
                    <li key={l.uid}>
                      <Link
                        href={`/lead?uid=${encodeURIComponent(l.uid)}`}
                        className="hover:underline"
                      >
                        {l.reference ?? l.uid}
                      </Link>{" "}
                      <span className="text-xs text-muted-foreground">
                        {l.authority} · {formatDate(l.decided_date)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {app.project_id != null && (
            <LeadMetaSection projectId={Number(app.project_id)} meta={meta} />
          )}
        </aside>
      </div>
    </div>
  );
}
