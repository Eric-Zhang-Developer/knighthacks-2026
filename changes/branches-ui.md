## What shipped
A "Branch this idea" panel. "Suggest directions" lists up to three. "Branch this way" turns one into a sibling version with its own star in the galaxy, and "Branch manually" edits one field into a new branch. The branch trail shows one row per generation with siblings side by side. Selecting a branch makes it the active version, shows its fields and highlights its neighbors. Branch stars come back after a reload.
## Where it lives
`components/branches/` (index.tsx, tree.ts, branches.module.css), `tests/branches-ui/`, `tests/e2e/branches-ui/` (AI_STUB_DIR fixtures)
## How to check it
verify: `node scripts/verify.mjs branches-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/branches-ui/20261010T144007Z` pass at 6105005 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/branches-ui/20261010T144007Z)
Run with `DATABASE_URL` set to the Neon test branch and `AI_STUB_DIR=tests/e2e/branches-ui/fixtures AI_STUB_ALLOW=1`. The e2e checks against the real trail API that both branches have version 1 as parent, and was confirmed to fail if branch stars weren't restored on reload. 22 neighboring e2e tests pass.
## Gaps
- Directions are stubbed in the e2e; this hasn't been run with live Gemini (#61).
- Manual branching is untested: no unit test or e2e exercises it. The e2e covers suggested directions, as Validation asks.
- Sibling branch stars can overlap when their five nearest projects match, because placement is the neighbors' centroid.
