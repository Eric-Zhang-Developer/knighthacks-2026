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
   On the first visit to `/`, initialize through `POST /api/workspace`; show the current
   workspace identity and an invite control. Reuse the server session on later visits.
2. Request an invite with `POST /api/workspace/invite` and present its link.
3. `app/invite/[token]/` redeems through `POST /api/workspace/invite/redeem`, then
   displays the joined workspace identity and leads to `/`. Do not create an unrelated
   workspace before invite redemption or consume the token through GET/prefetch.
4. Display the no-recovery notice and visible, recoverable initialization/invite errors.

## Requirements
- Browser A's first visit to `/` creates its workspace/member and sets the backend's
  HttpOnly, Secure, SameSite=Lax cookie through the API. No manual initialization step.
- Browser B opening A's invite joins the same workspace as its second member.
- Reusing or opening an expired invite receives 410 from redemption and visibly shows
  that the invite is unavailable; it must not claim a successful join.
- No recovery: clearing cookies loses the guest workspace, and the UI says so.
- Session secrets are never copied into client storage or readable UI state.
- Initialization must not issue duplicate creation/redemption requests because of
  component remounts. Preserve the existing layout metadata and all other feature mounts.

## Validation
1. Two fresh browser contexts against a real dedicated Neon test branch: A opens `/`
   without manually calling an API; verify its cookie is set. A creates an invite in
   the UI. B opens that exact link; both browsers display the same workspace ID.
2. Reuse the same link in another fresh browser context: the redemption response is
   410 and the page shows invite unavailable. Cover an expired link equivalently.
3. The no-recovery warning is visible. Clear A's cookies and return to `/`: the old
   workspace is no longer accessible and initialization yields a different workspace.
4. `tests/e2e/guest-workspace-ui/` covers 1–3 using the actual backend, with no intercepted
   session/invite responses. Keep a screenshot and sanitized responses/cookie attributes;
   never retain raw session cookies or invite-token capabilities in evidence.

## Defaults
No accounts or recovery. Backend-only API verification does not satisfy these browser checks.
