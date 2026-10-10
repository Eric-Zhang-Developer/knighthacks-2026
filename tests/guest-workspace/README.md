# Backend integration checks

Use a disposable Neon test branch in DATABASE_URL, run `pnpm db:push`, then
`python .agents/scripts/verify.py --slug guest-workspace --worktree .`.
The verifier builds and serves the actual Next app, exercises distinct cookie jars,
and records sanitized observed API results: host-cookie HttpOnly/Secure/SameSite=Lax
and Path=/ attributes (never values), both members' GET identity persistence, POST
session reuse, anonymous 401, invite replay and expiry. Both concurrency variants
also query the actual database and require exactly two workspace members. Evidence
JSON contains only public IDs, statuses, cookie attributes and counts, never raw
Set-Cookie headers, session credentials or invite URLs/tokens.
Missing DB access/schema is a failure, never a mock pass. Each test records only
workspace IDs returned by its successful create requests, including the stranger
workspace. Fixture teardown uses parameterized exact-ID deletes in a finally block;
foreign-key cascades remove those workspaces' members and invites. Teardown attempts
all recorded IDs and fails visibly if a delete fails, without exposing database errors.
The test runner and app must use the same dedicated test-branch DATABASE_URL.

Cleanup does not authorize testing against production or a shared database. A killed
process, lost create response, malformed identity, or unavailable database may leave
rows behind; inspect that isolated test branch rather than issuing broad cleanup.
No real database cleanup or race test has been verified on Windows without credentials.

Vitest routes.test.ts mocks persistence and checks HTTP/auth boundaries only. It
does not establish database atomicity. The DB race tests above are required.

Frontend integration belongs to the separate `guest-workspace-ui` feature accepted
in PR #101. Claude owns the root mount POST /api/workspace only on `/`;
GET /api/workspace returns {workspaceId, memberId}; POST /api/workspace/invite
with JSON {} returns {inviteUrl, expiresAt}; invite page POSTs JSON {token} to
/api/workspace/invite/redeem. Mutating browser requests must be same-origin.
The browser keeps the HttpOnly cookie; do not store or pass session tokens in JS.
Show that clearing cookies loses access. GET invite links must not consume tokens.
Opening `/` alone does not yet initialize a workspace: first-visit, invite-page,
no-recovery and share-route exclusion acceptance require Claude's frontend checks.
Passing these API tests completes none of those browser acceptance steps.
