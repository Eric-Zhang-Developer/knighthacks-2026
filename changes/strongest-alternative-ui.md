## What shipped
"Strongest existing alternative" panel above the evidence cards for the active idea version: the top neighbor's title and source link, then its points, each with the workflow step it addresses and a word-and-shape label; collapsed to the first point with "N more points" to expand. An idea with no workflow gets a prompt to add one. Loading and failure (with Retry) use `PanelState`.
## Where it lives
`components/evidence/alternative.tsx`, mounted from `components/evidence/index.tsx` as its own region; `tests/e2e/strongest-alternative-ui/`.
## How to check it
verify: `node scripts/verify.mjs strongest-alternative-ui .git/agent-evidence/strongest-alternative-ui/20261010T152602Z` pass at b9b92d8 (Mac; Neon test branch; real save and alternative API, generation fixture for the real top neighbor; screenshots `alternative.png`, `missing-workflow.png`). The evidence cards' e2e passes unchanged at the same commit: `node scripts/verify.mjs neighbor-evidence-ui .git/agent-evidence/neighbor-evidence-ui/20261010T152715Z` pass at b9b92d8.
## Gaps
Not run against a live model (point text is fixture text). Production schema pending (#113).
