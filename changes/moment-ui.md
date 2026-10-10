## What shipped
"Show me the moment" in the share panel, above "Create a read-only link": three numbered steps for the active version, each with what the judge does, what appears and what it demonstrates (with its `ClaimBadge`), plus the labelled basis. A stored moment loads with `GET`; otherwise a button generates one. The read-only `/s/:token` page never renders or fetches it.
## Where it lives
`components/share/Moment.tsx`, mounted in `components/share/index.tsx`; `tests/e2e/moment-ui/`; the on-request default is recorded in `specs/features/moment-ui/spec.md`.
## How to check it
verify: `node scripts/verify.mjs moment-ui .git/agent-evidence/moment-ui/20261010T170545Z` pass at d007cf8 (Mac; Neon test branch; real save, snapshot, share and moment APIs; generation fixture; screenshot `moment.png`). The share panel's e2e passes unchanged at the same commit: `node scripts/verify.mjs share-qr-ui .git/agent-evidence/share-qr-ui/20261010T170711Z` pass at d007cf8.
## Gaps
Step text in the test is fixture text (the API was run live once in #197). Production schema pending (#113).
