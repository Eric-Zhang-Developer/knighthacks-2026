## What shipped
Next.js 15 app shell (search, galaxy, side panels, voice bar), one stub per UI area, a shared client store, lazy Neon/Drizzle access, `GET /api/health`, CI project checks (typecheck, lint, unit, build) and the verifier.
## Where it lives
`app/`, `components/*/index.tsx`, `lib/store.ts`, `lib/db.ts`, `drizzle.config.ts`, `scripts/verify.mjs`, `scripts/db-setup.mjs`, `tests/`, `.env.example`, `.github/workflows/ci.yml`, `.agents/config.toml` (`[verify].command`)
## How to check it
verify: `node scripts/verify.mjs bootstrap /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/bootstrap/20261010T094827Z` pass at 2439b1d (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/bootstrap/20261010T094827Z)
## Gaps
- `pnpm db:push` (pgvector + schema push) is untested: no `DATABASE_URL` yet (#11). The first feature with a schema (corpus-embed or guest-workspace) proves it.
- Not deployed: the Vercel project is #13. E2E runs locally only, not in CI.
