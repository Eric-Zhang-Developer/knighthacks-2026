## What shipped
Idea interpretation/save/reload remains available; the saved card now follows accepted revisions and earlier selected branches, with stale-read guards that preserve selection, drafts and previews (#136).
## Where it lives
`components/idea/`, `tests/idea-create-ui/`, `tests/e2e/idea-create-ui/`; selected-version requirements and validation in `specs/features/idea-create-ui/spec.md`.
## How to check it
verify: `node scripts/verify.mjs idea-create-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/idea-create-ui/20261010T182424Z` pass at 41c558d (3 passed: save becomes a star among highlighted neighbors and survives reload, failed interpretation keeps the text, saved card follows accepted revisions). Run with `AI_STUB_DIR=tests/e2e/idea-create-ui/fixtures AI_STUB_ALLOW=1`; without them both stubbed tests stop at their guard.
## Gaps
Interpretation and revisions are stubbed in the e2e; no live AI or user trial claimed. The earlier canonical FAIL at `9b111d4` was the neighbor golden reading the 100-record bundle against an 8,409-record database; #191 published the matching bundle and it passes now.
