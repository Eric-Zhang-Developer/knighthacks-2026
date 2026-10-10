## What shipped
A "Share" panel. "Create a read-only link" shares the snapshot chosen in Decide, or says to choose one first. It shows the link and a QR code generated in the browser, and the owner can revoke it. `/s/:token` is a light, phone-first, unlisted page built only from `GET /api/shares/:token`. It sets no cookie, and a revoked link shows "This link was revoked by its owner."
## Where it lives
`components/share/` (index.tsx, SharedSnapshot.tsx, share.module.css, shared.module.css), `app/s/[token]/page.tsx`, `tests/e2e/share-qr-ui/` (fixture)
## How to check it
verify: `node scripts/verify.mjs share-qr-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/share-qr-ui/20261010T152248Z` pass at b3d0fd8 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/share-qr-ui/20261010T152248Z)
Run with `DATABASE_URL` set to the Neon test branch and `AI_STUB_DIR` a fresh absolute temp folder (the test copies its fixtures and writes neighbour evidence fixtures into it) and `AI_STUB_ALLOW=1`. A fresh 390px context reads the snapshot with no cookies and no Set-Cookie; after revoking it gets the revoked message and the API returns 410. The no-cookie check was confirmed to fail when the page starts a session. 21 neighboring e2e tests pass, including guest-workspace-ui's share-exclusion test.
## Gaps
- The QR code is checked to be a PNG data URL, but nothing scans it.
- Share finds the chosen snapshot through the Decide panel's `data-snapshot-id`, so the two panels are coupled through the page.
- A link is shown only in the session that made it; there's no list of existing links to revoke later.
