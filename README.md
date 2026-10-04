# PAM web client

Web UI for PAM (Planning Application Monitor) — surfaces London planning
applications as leads for architecture photography outreach. Reads from the
Supabase Postgres populated by the fetcher worker ([simoPh83/pam](https://github.com/simoPh83/pam),
running on Railway). **This app never writes to the fetcher tables** — human
data lives in `ui_*` tables (`ui_outreach`, `ui_lead_meta`, `ui_saved_filters`).

See `web-client-kickoff/` for the full brief and database contract.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui + TanStack Table
- Supabase Auth (invite-only email magic links; no sign-up page)
- Deployed on Vercel (env vars configured there)

## Setup

```bash
pnpm install
cp .env.example .env.local   # then fill in values
```

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API Keys → anon/publishable key (safe for browser; RLS protects data) |
| `DATABASE_URL` | Local only, for `pnpm migrate` (session/transaction pooler string) |

Run the dev server:

```bash
pnpm dev
```

Apply SQL migrations (files in `supabase/migrations/`, idempotent):

```bash
pnpm migrate        # apply migrations
pnpm verify:db      # sanity-check leads view + ui tables + RLS
```

## Auth

Users are invited from the Supabase dashboard (Authentication → Users →
Invite); public sign-ups are disabled. All routes except `/login` and
`/auth/callback` require a session (enforced by `proxy.ts`).

For magic links to work after deploy, add both `http://localhost:3000` and the
Vercel domain under Supabase → Authentication → URL Configuration.

## Database rules

- Fetcher tables (`applications`, `state_history`, `jobs`, …) are **read-only**
  for this app — RLS grants `authenticated` SELECT only, `anon` nothing.
- `ui_*` tables are shared between all signed-in users; every outreach row
  records `created_by`/`created_by_email`.
- Always read full URLs from the `applications_full` view (stored URLs are
  shortened tails).
- Date columns are Postgres `date` (converted from TEXT on 2026-10-04).

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |
| `pnpm migrate` | Apply `supabase/migrations/*.sql` |
| `pnpm verify:db` | Check DB objects exist |
