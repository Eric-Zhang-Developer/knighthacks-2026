---
name: Share a snapshot as a revocable read-only link with a QR code
depends_on: [decision-snapshot]
owns: [app/api/shares/, app/s/, lib/shares/, components/share/, db/schema/shares.ts, tests/share-qr/, tests/e2e/share-qr/]
assignee: ""
---

# Save, share and QR (F10)

## Plan
1. `POST /api/shares` -> a random token for a snapshot; `/s/:token` is a light, phone-friendly read-only page.
2. Show the link and a QR code; the owner can revoke.

## Requirements
- `/s/:token` grants no workspace access and no cookie.
- Revoked -> 410 with a plain message.

## Validation
1. Create a share; open it in a fresh browser context at phone width -> the snapshot; no workspace cookie set.
2. Revoke -> 410. `tests/e2e/share-qr/` covers 1–2; keep a phone-width screenshot.

## Defaults
Generate the QR code client-side.
