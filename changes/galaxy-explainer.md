## What shipped
A collapsed "What am I looking at?" panel at the galaxy's bottom-left: the project count and per-event coverage, both computed from `stars.json`, and plain statements that nearness means similar descriptions, the 3D layout is only a projection of the embedding space, and empty space doesn't mean an idea is original. It renders nothing when the corpus isn't loaded.
## Where it lives
`components/explainer/` (index.tsx, summary.ts, explainer.module.css), `tests/galaxy-explainer/`, `tests/e2e/galaxy-explainer/`
## How to check it
verify: `node scripts/verify.mjs galaxy-explainer /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/galaxy-explainer/20261010T110110Z` pass at b72133d (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/galaxy-explainer/20261010T110110Z)
## Gaps
- Checked against the 100-record corpus (`2026-10-10-100`, 4 events). The full corpus lands later; the e2e reads whichever `stars.json` is committed.
- Coverage counts events as `stars.json` names them; it doesn't show date ranges, because `year` is the project's created year, not the event date.
