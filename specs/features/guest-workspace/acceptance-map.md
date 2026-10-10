# Original acceptance mapped to API and UI

This mapping is not evidence that either half has shipped. The original
end-to-end requirements remain required across both features.

| Original guest-workspace requirement | Responsible feature and verification |
| --- | --- |
| Tables workspaces, members, invites | guest-workspace API plan and real Neon validation |
| First visit creates workspace/member and secure HttpOnly, Secure, SameSite=Lax cookie | API creates the session; UI mounts initialization in app/layout.tsx only for pathname / and verifies first visit without manual API calls |
| Single-use invite expires in 24 hours | API enforces and tests expiry/reuse; UI displays unavailable state on 410 |
| /invite/:token joins the second member | UI owns app/invite/; explicit Join calls redemption without pre-creating a workspace; GET/prefetch does not consume the token; two actual browser contexts verify the journey |
| require.ts returns caller workspace or 401; every later route uses it | API requirement and missing-session check; downstream API dependencies remain unchanged |
| At most two members | API atomic redemption, including same-token/different-token races |
| Workspace mutation rejects non-members with 403 | API authorization checks |
| A opens /, creates invite; B opens it; same workspace ID | guest-workspace-ui validation 1, backed by real test Neon; not replaced by API-only mocks |
| Reusing link returns 410; keep responses | Both API and UI acceptance assert the redemption response; retained evidence is sanitized |
| Clearing cookies loses workspace; UI explains no recovery | API session behavior plus UI visible notice and cookie-clearing browser test |

`app/layout.tsx` becomes explicit UI ownership so mounting does not require a
separate unowned helper change. Because this layout also wraps share pages, UI
validation 4 explicitly proves `/s/*` causes no workspace creation/redemption POST
and no workspace Set-Cookie or cookie in a fresh browser context. An unknown share
URL/404 suffices without depending on downstream share creation; `share-qr-ui` keeps
its real shared-snapshot acceptance. API and UI test directories are exclusive. No
existing downstream API dependency is renamed or removed.

`idea-create-ui` also waits for
`guest-workspace-ui`, retaining its existing API and galaxy prerequisites. Its
browser save/reload acceptance therefore cannot be marked complete before the
first-visit session mount exists. Backend API work can still proceed independently.
