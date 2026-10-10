---
name: First-visit guest workspace and teammate invite browser journey
depends_on: [guest-workspace]
owns: [app/invite/, components/workspace/, app/layout.tsx, tests/guest-workspace-ui/, tests/e2e/guest-workspace-ui/]
assignee: ""
---

# Guest workspace: UI

Frontend half: Mac workers only (user decision 2026-10-10). Build against the shared
API contract in `guest-workspace/spec.md`. The backend remains responsible for
session security, membership limits, invite expiration and authorization.

## Plan
1. Mount the workspace client boundary from `components/workspace/` in `app/layout.tsx`.
   Automatically initialize through `POST /api/workspace` only when the pathname is
   exactly `/`; show the current workspace identity and an invite control. Reuse the
   server session on later visits. The global layout must not initialize other paths.
2. Request an invite with `POST /api/workspace/invite` and present its link.
3. `app/invite/[token]/` displays an explicit Join action. Only that action sends
   `POST /api/workspace/invite/redeem`, then displays the joined workspace identity
   and leads to `/`. Invite paths only redeem; never pre-create an unrelated workspace
   or consume a token through GET/prefetch. `/s/*` never creates or redeems a session
   and never sets a workspace cookie.
4. Display the no-recovery notice and visible, recoverable initialization/invite errors.

## Requirements
- Browser A's first visit to `/` creates its workspace/member and sets the backend's
  HttpOnly, Secure, SameSite=Lax cookie through the API. No manual initialization step.
- Browser B opens A's invite and explicitly chooses Join to become the second member
  of the same workspace. Loading or prefetching the invite alone changes no session.
- Choosing Join on a reused or expired invite receives 410 from redemption and visibly shows
  that the invite is unavailable; it must not claim a successful join.
- No recovery: clearing cookies loses the guest workspace, and the UI says so.
- Session secrets are never copied into client storage or readable UI state.
- Initialization must not issue duplicate creation/redemption requests because of
  component remounts. Preserve the existing layout metadata and all other feature mounts.

## Validation
1. Two fresh browser contexts against a real dedicated Neon test branch: A opens `/`
   without manually calling an API; verify its cookie is set. A creates an invite in
   the UI. B opens that exact link; before Join, no creation/redemption POST or workspace
   cookie occurs. B chooses Join; both browsers display the same workspace ID.
2. Reuse the same link in another fresh browser context and choose Join: the redemption response is
   410 and the page shows invite unavailable. Cover an expired link equivalently.
3. The no-recovery warning is visible. Clear A's cookies and return to `/`: the old
   workspace is no longer accessible and initialization yields a different workspace.
4. In a fresh browser context, open a share-shaped URL such as `/s/layout-exclusion-check`.
   Observe actual browser traffic through page load and hydration: no POST to
   `/api/workspace` or its subpaths, no workspace `Set-Cookie` response header, and no
   workspace cookie in the context. An unknown share route/404 is sufficient for this
   early global-layout exclusion check; do not depend on `share-qr-ui` or create a real
   share, which would introduce a downstream dependency cycle. `share-qr-ui` retains
   its own successful real shared-snapshot validation.
5. `tests/e2e/guest-workspace-ui/` covers steps 1 through 4 using the actual backend, with no intercepted
   session/invite responses. Keep a screenshot and sanitized responses/cookie attributes;
   never retain raw session cookies or invite-token capabilities in evidence.

## Defaults
No accounts or recovery. Backend-only API verification does not satisfy these browser checks.
