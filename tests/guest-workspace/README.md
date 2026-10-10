# Backend integration checks

Use a disposable Neon test branch in DATABASE_URL, run `pnpm db:push`, then
`python .agents/scripts/verify.py --slug guest-workspace --worktree .`.
The verifier builds and serves the actual Next app, exercises distinct cookie jars,
and records API responses plus same-token and different-token redemption races.
Missing DB access/schema is a failure, never a mock pass. Test workspaces remain
on the disposable branch; reset that test branch after inspection.

Vitest routes.test.ts mocks persistence and checks HTTP/auth boundaries only. It
does not establish database atomicity. The DB race tests above are required.

Frontend integration remains Claude-owned: root mount POST /api/workspace;
GET /api/workspace returns {workspaceId, memberId}; POST /api/workspace/invite
with JSON {} returns {inviteUrl, expiresAt}; invite page POSTs JSON {token} to
/api/workspace/invite/redeem. Mutating browser requests must be same-origin.
The browser keeps the HttpOnly cookie; do not store or pass session tokens in JS.
Show that clearing cookies loses access. GET invite links must not consume tokens.
Opening `/` alone does not yet initialize a workspace: the root-first-visit and
invite-page browser acceptance criteria require Claude's frontend integration.
