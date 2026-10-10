---
name: Create and revoke read-only share tokens for snapshots
depends_on: [decision-snapshot-api]
owns: [app/api/shares/, lib/shares/, db/schema/shares.ts, tests/share-qr-api/, tests/e2e/share-qr-api/]
assignee: ""
---

# Save, share and QR (F10): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it stays unclaimed for 15 minutes, so the backend chain never waits on one machine.

## Plan
1. `POST /api/shares` `{"snapshotId"}` -> `{"token", "url"}` (a random token).
2. `GET /api/shares/:token` -> the snapshot JSON; revoked -> 410 `{"error": "revoked"}`.
3. `DELETE /api/shares/:token` (workspace owner only) revokes.

## Requirements
- `GET /api/shares/:token` sets no cookie and grants no workspace access.
- Only the owning workspace can revoke.

## Validation
1. Create a share; `GET` it without cookies -> the snapshot, no `Set-Cookie`; revoke -> 410.
2. `tests/e2e/share-qr-api/` covers 1.

## Defaults
Tokens are 128-bit random, URL-safe.
