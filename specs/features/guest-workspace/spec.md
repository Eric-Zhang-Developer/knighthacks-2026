---
name: Guest workspace with a single-use teammate invite
depends_on: [bootstrap]
owns: [app/api/workspace/, app/invite/, lib/workspace/, db/schema/workspace.ts, tests/guest-workspace/, tests/e2e/guest-workspace/]
assignee: ""
---

# Guest workspace

## Plan
1. Tables `workspaces`, `members`, `invites`.
2. First visit creates a workspace and member; random session ID in an HttpOnly, Secure, SameSite=Lax cookie.
3. `POST /api/workspace/invite` -> a single-use link expiring in 24 h; `/invite/:token` joins the second member.
4. `lib/workspace/require.ts`: returns the caller's workspace or 401. Every later route uses it.

## Requirements
- At most 2 members; a used or expired token -> 410.
- A route that changes a workspace rejects non-members with 403.

## Validation
1. Browser A opens `/` -> cookie set; creates an invite. Browser B opens the link -> both see the same
   workspace ID.
2. Reusing the link -> 410. `tests/e2e/guest-workspace/` runs both browsers. Keep the responses.

## Defaults
No recovery: clearing cookies loses the guest workspace, and the UI says so.
