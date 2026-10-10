## What shipped
"How it compares" panel: after an idea is saved (or on reload), evidence cards for its top 3 neighbors, then the rest on request. Each card shows shared and different claims with a word-and-shape label, a source link, and a title that opens the project in the drawer; uncertainty and the source excerpt sit behind an expander. Loading, failure (with Retry) and empty states are visible.
## Where it lives
`components/evidence/` (index.tsx, evidence.module.css), `tests/e2e/neighbor-evidence-ui/`.
## How to check it
verify: `node scripts/verify.mjs neighbor-evidence-ui .git/agent-evidence/neighbor-evidence-ui/20261010T140859Z` pass at 372a25c (Mac; Neon test branch; real save, embeddings and evidence API; generation fixtures written per neighbor; screenshot `evidence.png`).
## Gaps
Not run against a live model: card text in the test is fixture text. Production schema is still pending (#113), so the panel only works where `evidence_cards` exists. No unit tests: the component only renders API data, and the e2e covers its states.
