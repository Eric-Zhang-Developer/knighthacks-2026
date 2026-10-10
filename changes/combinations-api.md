## What shipped
Immutable workspace-scoped combinations join exactly two saved neighbors; invalid candidates are dropped and repeated/concurrent requests return the stored result.
## Where it lives
`app/api/combinations/`, `lib/combinations/`, `db/schema/combinations.ts`, `tests/combinations-api/`, `tests/e2e/combinations-api/`.
## How to check it
verify: `node scripts/verify.mjs combinations-api "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\combinations-api\20261010T181227Z"` pass at b764450; 293 unit tests passed, typecheck/lint/gates passed.
## Gaps
Generation used the required AI fixture; HTTP, embeddings and dedicated TEST-Neon persistence were real. Production schema/application and Mac-owned UI are separate; one existing deployment-only Foreman unit test skipped.
