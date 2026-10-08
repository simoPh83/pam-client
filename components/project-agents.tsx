import type { ProjectAgent } from "@/lib/types";

/**
 * Read-only block listing the PlanIt agent values found across all of a
 * project's applications. This is unverified application data — the user
 * verifies it against the application documents and then assigns a shared
 * practice (see PracticesSection).
 */
export function ProjectAgents({ agents }: { agents: ProjectAgent[] }) {
  if (!agents.length) return null;

  return (
    <div className="rounded-md border border-dashed p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          PlanIt agents{" "}
          <span className="font-normal text-muted-foreground">
            ({agents.length})
          </span>
        </h2>
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          read-only · application data
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Agent values returned by PlanIt across this project&apos;s
        applications — unverified. Check the application documents, then assign
        a practice once confirmed.
      </p>
      <ul className="space-y-3 text-sm">
        {agents.map((a, i) => (
          <li key={`${a.agent_company}-${a.agent_name}-${i}`}>
            <div className="font-medium">
              {a.agent_company ?? a.agent_name}
            </div>
            {a.agent_company && a.agent_name && (
              <div className="text-xs text-muted-foreground">{a.agent_name}</div>
            )}
            {a.agent_address && (
              <div className="text-xs whitespace-pre-line text-muted-foreground">
                {a.agent_address}
              </div>
            )}
            {a.references.length > 0 && (
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                on: {a.references.join(", ")}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
