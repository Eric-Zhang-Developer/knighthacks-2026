## What shipped
Revocable 128-bit snapshot links: hash-only storage, cookie-free reads, owning-workspace revocation, and uncached 410 responses. The verifier now prepares neighbor-evidence fixtures before creating its snapshot (#267).
## Where it lives
`app/api/shares/`, `lib/shares/`, `db/schema/shares.ts`, `tests/share-qr-api/`, `tests/e2e/share-qr-api/`.
## How to check it
verify: `node scripts/verify.mjs share-qr-api "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\share-qr-api\20261010T205017Z"` pass at d594c8b (uncommitted changes). Real Neon/HF, five evidence fixtures; anonymous read, no cookies/workspace access, hash-only storage and repeat-safe revocation passed in 2.0 minutes.
## Gaps
Evidence generation is stubbed; no new deployed or user trial claimed. QR/page rendering belongs to share-qr-ui. An already-read response cannot be recalled; later requests return 410. No Validation step skipped. Other #267 suites remain with their owners.
