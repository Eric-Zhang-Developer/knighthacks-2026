## What shipped
Revocable 128-bit snapshot links: hash-only token storage, cookie-free public JSON reads, same-origin creation, owning-workspace revocation, and uncached 410 responses after revocation.
## Where it lives
`app/api/shares/`, `lib/shares/`, `db/schema/shares.ts`, `tests/share-qr-api/`, `tests/e2e/share-qr-api/`.
## How to check it
verify: `node scripts/verify.mjs share-qr-api "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\share-qr-api\20261010T150133Z"` pass at b07793b. Real Neon/HF, no generation fixtures; anonymous read, no cookies/workspace access, hash-only storage and repeat-safe revocation passed. 177 unit tests passed.
## Gaps
Production schema awaits #113; no deployed or user trial claimed. QR/page rendering belongs to share-qr-ui. An already-read response cannot be recalled; later requests return 410. No Validation step skipped.
