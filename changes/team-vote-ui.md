## What shipped
"Team vote" panel: pick a preferred version (every idea's latest, plus the active idea's versions) and one concern (≤200 chars). Until both teammates vote it shows only your vote and "Waiting for your teammate"; then both votes, whether you agree (✓/≠ plus words), and any vote changed after the reveal. It polls the API every 4 s and renders only what the API returns.
## Where it lives
`components/votes/` (index.tsx, votes.module.css), `tests/e2e/team-vote-ui/`.
## How to check it
verify: `node scripts/verify.mjs team-vote-ui .git/agent-evidence/team-vote-ui/20261010T143543Z` pass at 6a6fcd6 (Mac; two browsers, owner + invited teammate, Neon test branch; screenshots `browser-a.png`, `browser-b.png`).
## Gaps
A one-member workspace waits forever with no hint to invite a teammate. The test blocks the evidence API, which isn't under test, to avoid live model calls. No unit tests: the component only renders API state, and the e2e covers each state.
