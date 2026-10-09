// Architect-hunter time police. Registered as an inline PreToolUse hook in
// .github/agents/Architect-hunter.agent.md — runs before EVERY tool call.
// Reads the deadline file written at hunt launch and denies tool calls once
// the budget has expired. Fast: no I/O beyond one small file read.
//
// Deadline file: research/downloads/.hunt-deadline (ISO 8601 timestamp).
// Written by the parent agent/user at hunt launch — never by the hunter.
// Missing file           -> allow (no active hunt)
// Deadline in the future -> allow
// Deadline passed        -> DENY all tool calls, workspace-wide (this hook is
//                           registered globally in .github/hooks/ so the parent
//                           agent is blocked too — the budget covers the WHOLE
//                           hunt, whoever does the work)
// Deadline >10s stale    -> delete file and allow (the freeze only exists to
//                           stop a spent hunt being continued; keep it short so
//                           the workspace unlocks immediately after each run)

import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const FILE = join(process.cwd(), "research", "downloads", ".hunt-deadline");
const STALE_MS = 10 * 1000;

// consume stdin (hook payload) — not needed, but keep the pipe drained
process.stdin.resume();
process.stdin.on("end", () => {
  let deadline;
  try {
    deadline = new Date(readFileSync(FILE, "utf8").trim());
  } catch {
    process.exit(0); // no file -> allow
  }
  if (isNaN(deadline.getTime())) process.exit(0);

  const overBy = Date.now() - deadline.getTime();
  if (overBy < 0) process.exit(0); // still within budget -> allow

  if (overBy > STALE_MS) {
    rmSync(FILE, { force: true }); // stale deadline from an old hunt
    process.exit(0);
  }

  const reason =
    `Hunt time budget expired ${Math.round(overBy / 1000)}s ago ` +
    `(deadline ${deadline.toISOString()}). Tool calls are now blocked. ` +
    `Write your final report NOW as plain text: findings so far, ` +
    `Started/Ended timestamps, and which step was interrupted.`;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
});
