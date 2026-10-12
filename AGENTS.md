<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PAM client — working notes for agents

## What this is
Next.js web UI (`simoPh83/pam-client`) over the Supabase Postgres populated by
the **sibling repo `simoPh83/pam`** (Python fetcher/worker on Railway). Locally
the sibling usually lives at `..\PAM` (next to this folder). Cross-repo specs
live in `docs/` (e.g. `docs/2026-10-12-manual-resolution-ui-spec.md`); backend
RPCs/tables are defined in the PAM repo (`scripts/apply_*_rpc.py`).

## Rules
- The app **never writes fetcher tables** (`applications`, `projects`,
  `project_applications`, `grouping_review`, `missing_parents`, …). Writes go
  through SECURITY DEFINER RPCs (`apply_grouping_resolution`,
  `resolve_review_with_ref`, `resolve_review_singleton`, …) or `ui_*` tables.
- Backend changes (new RPCs, schema on fetcher tables) belong in the PAM repo;
  write a spec in `docs/` instead of working around it here.
- Reads use the Supabase anon key + user session (RLS applies). Server code:
  `lib/supabase/server.ts`; mutations are server actions in `lib/actions.ts`,
  reads in `lib/queries.ts`, shared types in `lib/types.ts`.
- Lead detail is addressed by `/lead?uid=<uid>` (uids contain slashes).

## Database access
- Config lives in `.env.local` (gitignored; template `.env.example`):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and local-only
  `DATABASE_URL` (Postgres pooler string). Never commit or print secrets;
  `SUPABASE_SERVICE_ROLE_KEY` is server-only and avoided.
- Ad-hoc SQL / migrations use `pg` with `DATABASE_URL` read from `.env.local`
  (swap `:6543` → `:5432` for session mode, `ssl: { rejectUnauthorized: false }`).
  See `scripts/verify-db.mjs` for the pattern.
- `pnpm migrate` applies `supabase/migrations/*.sql` (idempotent, add-only);
  `pnpm verify:db` sanity-checks views/policies.

## Commands (pnpm)
`pnpm dev` · `pnpm typecheck` · `pnpm lint` · `pnpm build`.
Note: `pnpm lint` has a pre-existing error in `components/site-nav.tsx`;
lint touched files directly (`node_modules\.bin\eslint <files>`).

## Environment (Windows)
PowerShell shell; use `;` not `&&`. Next.js here is v16 with breaking changes —
consult `node_modules/next/dist/docs/` before writing framework code.
Repo path may differ per device; don't hardcode absolute paths in code.
**Encoding trap:** never read+rewrite source files via PowerShell
(`Get-Content`/`WriteAllText`) — Windows PowerShell 5.1 silently re-encodes
UTF-8 as Windows-1252 and corrupts `·`, `—`, `…` into `Â·` mojibake. Use the
edit tool for file changes; if PowerShell is unavoidable, force
`[IO.File]::ReadAllText/WriteAllText` with explicit UTF-8 (no BOM).

