## What shipped
Workspace-scoped POST/GET build plans: each POST appends, GET returns latest; sourced tour/cuts/risks and increasing timeline ending in Code freeze at least one hour before the deadline.
## Where it lives
`app/api/plan/[versionId]/route.ts`, `lib/plan/`, `db/schema/plan.ts`, `tests/build-plan-api/`, `tests/e2e/build-plan-api/`; request/response and test-schema decisions in `specs/decisions/build-plan-api-*`.
## How to check it
verify: `node scripts/verify.mjs build-plan-api /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/build-plan-api/20261010T210158Z` pass at a74fa36 (uncommitted changes) (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/build-plan-api/20261010T210158Z)
## Gaps
Fixture acceptance also passed at 20261010T210051Z (concurrent append, unchanged old rows, foreign workspace, bad origin, invalid output). Live Gemini used test Neon and real saved neighbor excerpts; its 10-hour plan froze at hour 8.5. Production schema remains coordinated under #113; no frontend, corpus changes, production acceptance or user trial claimed.
