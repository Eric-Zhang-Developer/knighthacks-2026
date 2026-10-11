## What shipped
"Team vote" panel: pick a preferred version (every idea's latest, plus the active idea's versions) and one concern (≤200 chars). Until both teammates vote it shows only your vote and "Waiting for your teammate"; then both votes, whether you agree (✓/≠ plus words), and any vote changed after the reveal. It polls the API every 4 s and renders only what the API returns.
## Where it lives
`components/votes/` (index.tsx, Waiting.tsx, votes.module.css), `tests/team-vote-ui/`, `tests/e2e/team-vote-ui/`.
## How to check it
verify: `node scripts/verify.mjs team-vote-ui .git/agent-evidence/team-vote-ui/20261010T143543Z` pass at 6a6fcd6 (Mac; two browsers, owner + invited teammate, Neon test branch; screenshots `browser-a.png`, `browser-b.png`).
## Gaps
While waiting, the panel says both teammates must vote and points at Invite a teammate (#220); the API has no member count, so it can't say which case applies, and the one-member case isn't in the e2e. The test blocks the evidence API, which isn't under test, to avoid live model calls. Only the waiting hint has a unit test; the e2e covers the other states.
