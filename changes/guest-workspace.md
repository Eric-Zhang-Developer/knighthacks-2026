## What shipped
Guest workspace APIs with secure cookie sessions, single-use 24-hour invites, atomic two-member limits and workspace authorization.
## Where it lives
`app/api/workspace/`, `lib/workspace/`, `db/schema/workspace.ts`; unit and integration tests under `tests/guest-workspace/` and `tests/e2e/guest-workspace/`.
## How to check it
verify: `node scripts/verify.mjs guest-workspace .git/agent-evidence/guest-workspace/20261010T131141Z` pass at a5628a5 (Mac, dedicated Neon `test` branch exported as DATABASE_URL; 4/4 API scenarios). 51 unit tests, typecheck and lint pass.
## Gaps
API Validation 1–4 passed against the test branch, not production. Browser acceptance belongs to `guest-workspace-ui` and is not completed by this feature.
