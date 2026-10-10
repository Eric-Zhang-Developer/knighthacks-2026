## What shipped
`scripts/db-sync.mjs` creates the tables, foreign keys and indexes `db/schema/` defines and a database lacks, in one transaction; it never drops or alters, refuses on a missing column, and outside the test branch runs only from a clean `origin/main`. `GET /api/health/schema` answers 503 naming missing tables, 200 `{"schema":"ok"}` otherwise; `/api/health` is unchanged.
## Where it lives
`scripts/db-sync.mjs`, `app/api/health/schema/`, `tests/db-sync/`, `tests/e2e/db-sync/`. Run: `node --env-file=.env.local scripts/db-sync.mjs` (dry run), then `--apply`.
## How to check it
verify: `node scripts/verify.mjs db-sync /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/db-sync/20261010T190529Z` pass at a71be54 (test branch: 200, ok). Same e2e against production's database, read-only: pass, 503 missing assumptions, combinations, moments, problem_evidence, research. Test branch: dropped `idea_versions_latest`, dry run planned it, `--apply` recreated it, rerun printed `nothing to apply`. Feature branch against production: exit 2.
## Gaps
- Production `--apply` not run by this PR: run it from a clean `origin/main` after merge (person approved on #113, option A).
- `/api/health/schema` isn't in `[release].smoke_paths` yet; that's a `contract:` PR.
- Drift was checked by unit test only: dropping a real column on the shared test branch would break other features. Indexes still match by name.
