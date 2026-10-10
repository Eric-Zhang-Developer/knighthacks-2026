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

On the first visit, call `POST /api/workspace` once and display loading or recoverable failure honestly. Invite creation sends an empty JSON object. At `/invite/:token`, show an explicit join action that invokes the redeem POST; rendering, prefetching, or opening the link alone must not consume it. Display that clearing cookies loses access, with no account recovery.

Root mounting requires Claude's separate allowed change to shared UI; Windows does not own `app/page.tsx`. Windows will not change `app/invite/` or any frontend component. The feature remains incomplete until two real browser sessions pass the original spec against a real Neon test branch, including first-visit initialization and the invite UI. Never save raw cookies or invite capabilities in public evidence.
