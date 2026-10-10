---
name: Share a snapshot as a revocable read-only link with a QR code
depends_on: [share-qr-api, decision-snapshot-ui]
owns: [app/s/, components/share/, tests/share-qr-ui/, tests/e2e/share-qr-ui/]
assignee: ""
---

# Save, share and QR (F10): UI

Frontend half: Mac workers only (user decision 2026-10-10). Build against the response shape pinned in `share-qr-api`; the routes exist once it is done.

## Plan
1. `/s/:token`: a light, phone-friendly read-only page built from `GET /api/shares/:token`.
2. Show the link and a QR code; the owner can revoke.

## Requirements
- `/s/:token` sets no workspace cookie.
- Revoked -> a plain 410 message.

## Validation
1. Create a share; open it in a fresh browser context at phone width -> the snapshot; no workspace cookie set.
2. Revoke -> 410. `tests/e2e/share-qr-ui/` covers 1–2; keep a phone-width screenshot.

## Defaults
Generate the QR code client-side.
