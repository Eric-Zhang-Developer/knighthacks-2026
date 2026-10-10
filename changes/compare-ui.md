## What shipped
A "Compare versions" panel that appears once the active idea has two or more versions (revisions or branches). Tick 2 or 3 versions and press Compare. The table has versions as columns ("Version N", in trail order) and the five judging criteria as rows. Each cell shows the reason with its claim badge and an "Uncertain:" note, and nothing that reads as a score.
## Where it lives
`components/compare/` (index.tsx, table.ts, compare.module.css), `tests/compare-ui/`, `tests/e2e/compare-ui/` (fixtures)
## How to check it
verify: `node scripts/verify.mjs compare-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/compare-ui/20261010T144932Z` pass at ba039f9 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/compare-ui/20261010T144932Z)
Run with `DATABASE_URL` set to the Neon test branch, `AI_STUB_DIR` set to a fresh absolute temp folder and `AI_STUB_ALLOW=1`. The e2e builds two real versions through the UI, then checks the table. Its no-digits check was confirmed to fail when a rank number was added. 18 neighboring e2e tests pass.
## Gaps
- Comparisons are stubbed in the e2e; this hasn't been run with live Gemini (#61). The e2e's reasons are inferred, so the supported-with-quote badge isn't exercised here.
- Comparing three versions is allowed but only two are exercised in the e2e.
