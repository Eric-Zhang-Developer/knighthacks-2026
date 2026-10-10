# Guest workspace frontend integration

Windows implements these server endpoints in PR #35. Claude owns the frontend integration. This document describes the in-progress contract, not completed acceptance.

| Request | Success | Errors |
| --- | --- | --- |
| `POST /api/workspace` | `201` for a new guest or `200` for an existing guest; `{workspaceId, memberId}` | `403` for cross-origin mutation; `503` if storage is unavailable |
| `GET /api/workspace` | `200` with `{workspaceId, memberId}` | `401` without a valid session; `503` if storage is unavailable |
| `POST /api/workspace/invite`, JSON `{}` | `201` with `{inviteUrl, expiresAt}` | `401` without a session; `409` if both seats are occupied |
| Same invite request with optional `{workspaceId}` | Same response if the caller belongs to that workspace | `403` for a different workspace |
| `POST /api/workspace/invite/redeem`, JSON `{token}` | `201` with `{workspaceId, memberId}` and replacement session cookie | `410` for malformed, used, expired, unavailable, or own-workspace invite |

All mutations require the browser's same-origin `Origin` header. JSON endpoints require `Content-Type: application/json`; malformed input returns `400`, oversized input `413`. Error bodies are `{error: string}`. Responses use `Cache-Control: no-store`.

The server owns an opaque `__Host-uncharted-session` cookie with `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`. The frontend must not read or store session tokens. Use same-origin browser fetches, which include the cookie automatically.

On the first visit to `/`, call `POST /api/workspace` once and display loading or recoverable failure honestly. Do not automatically initialize other paths. Invite creation sends an empty JSON object. At `/invite/:token`, show an explicit join action that invokes the redeem POST; rendering, prefetching, or opening the link alone must not consume it or pre-create a different workspace. `/s/*` must never create or redeem a session or set a workspace cookie. Display that clearing cookies loses access, with no account recovery.

The split accepted in PR #101 assigns Claude `guest-workspace-ui`, including the `app/layout.tsx` mount, invite UI and full two-browser journey. Windows owns the `guest-workspace` API and must pass its four Validation steps against a dedicated Neon test branch before backend completion. Those API checks do not establish browser acceptance; see `../guest-workspace-ui/spec.md` and `acceptance-map.md` for the preserved journey. Never save raw cookies or invite capabilities in public evidence.
