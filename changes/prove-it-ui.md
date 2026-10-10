## What shipped
In the Challenge panel, a round that ends with "Test it" offers "Prove it in ten minutes", which drafts an experiment. An Experiments list for the active version, loaded from `GET /api/experiments` so it survives a reload, shows each experiment with its round, assumption, an `unverified` hypothesis badge and editable hypothesis, procedure and what-to-watch fields. It reads "Result: Not run" until the user records confirmed, refuted or inconclusive with an optional note; after that the experiment is read-only. Rounds with any other outcome offer nothing.
## Where it lives
`components/challenge/` (Experiments.tsx, experiment.ts, index.tsx, challenge.module.css), `tests/prove-it-ui/`, `tests/e2e/prove-it-ui/` (fixtures)
## How to check it
verify: `node scripts/verify.mjs prove-it-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/prove-it-ui/20261010T152554Z` pass at beb45dc (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/prove-it-ui/20261010T152554Z)
Run with `DATABASE_URL` = `TEST_DATABASE_URL`, `AI_STUB_DIR` a fresh absolute temp folder and `AI_STUB_ALLOW=1`. `tests/e2e/challenge-ui/` passes unchanged with the same setup.
## Gaps
- The draft is stubbed in e2e; no live model run.
- Experiments list only the active version's; after a revision makes a new version, the earlier version's experiments show when that version is selected.
- Needs the `experiments` table on the main database (`specs/decisions/prove-it-api-schema.md`).
