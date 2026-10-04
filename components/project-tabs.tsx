"use client";

import { useRouter } from "next/navigation";
import type { ProjectMembership } from "@/lib/types";
import { formatMonthYear } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Member = ProjectMembership & {
  reference: string | null;
  app_state: string | null;
  app_type: string | null;
  decided_date: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  original: "Original",
  variation: "Variation",
  discharge: "Discharge",
  nma: "NMA",
};

export function ProjectTabs({
  members,
  currentUid,
  projectName,
}: {
  members: Member[];
  currentUid: string;
  projectName: string | null;
}) {
  const router = useRouter();

  if (members.length <= 1) return null;

  return (
    <div className="rounded-md border">
      <div className="border-b px-3 py-2 text-xs text-muted-foreground">
        Project: <span className="font-medium text-foreground">{projectName}</span>{" "}
        · {members.length} applications on this site
      </div>
      <div
        role="tablist"
        className="flex flex-wrap gap-1 p-2"
      >
        {members.map((m) => {
          const isCurrent = m.uid === currentUid;
          return (
            <button
              key={m.uid}
              role="tab"
              aria-selected={isCurrent}
              title={`${m.reference ?? m.uid} — ${ROLE_LABEL[m.role ?? ""] ?? m.role ?? "application"}${m.app_state ? ` — ${m.app_state}` : ""}`}
              onClick={() => router.push(`/lead?uid=${encodeURIComponent(m.uid)}`)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-xs transition-colors",
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent",
                m.is_root &&
                  !isCurrent &&
                  "bg-secondary font-semibold ring-1 ring-border"
              )}
            >
              {m.is_root && <span aria-hidden>★</span>}
              {m.reference ?? m.uid}
              <span className="font-sans text-[10px] opacity-70">
                {ROLE_LABEL[m.role ?? ""] ?? m.role}
                {m.decided_date ? ` · ${formatMonthYear(m.decided_date)}` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
