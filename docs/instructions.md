# Local development instructions

## Start the dev server

```powershell
pnpm dev
```

Then open http://localhost:3000 — sign in with your email + password.

Stop it with `Ctrl+C` in the terminal.

## Reload after pulling changes

Most code changes hot-reload automatically. If something looks stale
(e.g. 404 on a page you know exists, chunk load errors):

1. Stop the server (`Ctrl+C`)
2. Clear the build cache and restart:

```powershell
Remove-Item -Recurse -Force .next
pnpm dev
```

3. Hard-refresh the browser with `Ctrl+F5`

## After pulling new dependencies

```powershell
pnpm install
pnpm dev
```

## Database migrations

After pulling new files in `supabase/migrations/`:

```powershell
pnpm migrate      # apply pending migrations
pnpm verify:db    # sanity-check the DB objects
```

## Checks before committing

```powershell
pnpm typecheck    # TypeScript
pnpm lint         # ESLint
pnpm build        # production build (catches route/prerender issues)
```
