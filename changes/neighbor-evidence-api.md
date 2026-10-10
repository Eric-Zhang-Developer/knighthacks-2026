## What shipped
Workspace-scoped evidence cards quote real neighbor excerpts, downgrade unsupported or foreign-source claims, save top three by default and remaining cards with all=true, and reuse immutable rows on repeated or concurrent requests.
## Where it lives
app/api/evidence/, lib/evidence/, db/schema/evidence.ts, tests/neighbor-evidence-api/, tests/e2e/neighbor-evidence-api/.
## How to check it
verify: `node scripts/verify.mjs neighbor-evidence-api "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\neighbor-evidence-api\20261010T135025Z"` pass at d06bcb1; real Neon/HF, test-only generation fixtures, retained rows; 98 unit tests passed.
## Gaps
Generation is stubbed only for the specified E2E acceptance; no live evidence-generation claim. Test schema is applied; production schema rollout remains pending (#113). Earlier real verification caught PostgreSQL overlaps quoting (42601), fixed before this pass; textual provenance does not establish source truth.
