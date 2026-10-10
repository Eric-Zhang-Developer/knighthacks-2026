---
name: Guest workspace API with secure sessions and a single-use teammate invite
depends_on: [bootstrap]
owns: [app/api/workspace/, lib/workspace/, db/schema/workspace.ts, tests/guest-workspace/, tests/e2e/guest-workspace/]
assignee: ""
---

# Guest workspace: API

Backend half: Windows workers first. `guest-workspace-ui` owns first-visit mounting,
invite pages, and the complete two-browser journey. Both halves together preserve
the original guest-workspace acceptance; backend completion alone is not that journey.

## Plan
1. Tables `workspaces`, `members`, `invites`.
2. `POST /api/workspace` creates a workspace and member when no valid session exists;
   an existing session reuses its identity. Set a random session ID in an HttpOnly,
   Secure, SameSite=Lax cookie. `GET /api/workspace` returns the caller's identity or 401.
3. `POST /api/workspace/invite` creates a single-use link expiring in 24 h;
   `POST /api/workspace/invite/redeem` accepts its token and joins the second member.
4. `lib/workspace/require.ts` returns the caller's workspace or 401. Every later route uses it.

## Requirements
- At most 2 members, including concurrent redemption of the same or different invites.
- A used or expired token returns 410. Redemption and membership creation are atomic.
- A route that changes a workspace rejects non-members with 403.
- Session credentials stay in the cookie; responses expose identity, never another member's session.
- No recovery: clearing cookies loses access to the guest workspace. The UI half must explain this.

## Shared API contract
- `POST /api/workspace` returns `{workspaceId, memberId}`; 201 when created, 200 when reused.
- `GET /api/workspace` returns `{workspaceId, memberId}` for the current session; otherwise 401.
- `POST /api/workspace/invite` takes JSON `{}` (optionally `workspaceId` to assert the target)
  and returns 201 `{inviteUrl, expiresAt}`. The link points to `/invite/:token`.
- `POST /api/workspace/invite/redeem` takes JSON `{token}` and returns 201
  `{workspaceId, memberId}` with the joining member's secure session cookie.
- Used or expired invites return 410; an explicit non-member workspace target returns 403.
  Errors use `{error}`. UI requests are same-origin. Visiting or previewing a link must
  not consume it through a GET; the invite page performs the redemption POST.

## Validation
1. Against a real dedicated Neon test branch, session A initializes through the API:
   verify the secure cookie attributes and identity persistence. A creates an invite;
   isolated session B redeems it; both API identity responses show the same workspace ID
   and different member IDs. Keep sanitized responses and cookie attributes, not credentials.
2. Reusing or expiring the token returns 410. Missing-session reads return 401;
   a non-member's explicit workspace mutation returns 403.
3. Concurrent same-token and different-token redemption never produce a third member.
4. `tests/e2e/guest-workspace/` covers these API checks using real test Neon persistence.
   Unit mocks alone cannot satisfy this validation. Browser-first-visit and invite-page
   acceptance moves intact to `guest-workspace-ui`; see `acceptance-map.md`.

## Defaults
No recovery, no accounts. The frontend half owns the user-facing notice and initialization.
