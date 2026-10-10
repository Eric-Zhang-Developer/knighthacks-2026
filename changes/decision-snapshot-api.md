## What shipped
Workspace-authorized immutable snapshots now ensure the chosen version's top-three evidence batch before freezing (#177); saved cards are reused and evidence failure saves no snapshot. Frozen reads and the privacy allowlist are unchanged.
## Where it lives
`app/api/snapshots/`, `lib/snapshots/`, `db/schema/snapshots.ts`, `tests/decision-snapshot-api/`, `tests/e2e/decision-snapshot-api/`.
## How to check it
verify: `node scripts/verify.mjs decision-snapshot-api "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\decision-snapshot-api\20261010T162227Z"` pass at ba5d62e (uncommitted changes subsequently committed as 69f4413). Real Neon/HF with generation fixtures; branch evidence, failure/retry, cached reuse, immutable reads and privacy passed; 233 unit tests passed. Live cold-branch creation persisted three evidence entries in 26,656 ms; cached choice took 172 ms (agent-evidence/issue-177-baseline/).
## Gaps
Full live browser acceptance remains unverified: demo-flow at 69f4413 exceeded its 30-second snapshot assertion while Saving (20261010T162522Z); the unchanged retry exceeded the 240-second server-start limit before tests (20261010T163523Z). Missing cards can require three serial model calls. No production/user trial or full-demo pass claimed; no own-feature Validation skipped and no test limit weakened.
