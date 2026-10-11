## What shipped
Authenticated idea interpretation/create/list with idempotent real placement; confirmed workspace-scoped deletion removes its versions/dependents while preserving independent snapshot/share exports.
## Where it lives
app/api/ideas/, lib/ideas/, db/schema/ideas.ts, tests/idea-create-api/, tests/e2e/idea-create-api/; deletion receipt in specs/decisions/idea-create-api-deletion-verification.md.
## How to check it
verify: node scripts/verify.mjs idea-create-api 20261011T112033Z pass at390f5dc; both production-build E2E tests passed (3.7min) with generation fixtures, real HF and TEST Neon. Eight rollout-guard unit tests also pass; prior full suite556pass3skip, typecheck/lint passed.
## Gaps
Deletion is intentionally restricted to DATABASE_URL matching nonblank TEST_DATABASE_URL; production deletion rollout is not enabled or verified. Human voice/browser acceptance remains separate. Earlier verifier startup timeouts are superseded by this passing canonical run.
