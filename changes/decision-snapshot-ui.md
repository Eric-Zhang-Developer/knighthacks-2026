## What shipped
A "Decide" panel. "Choose this version" saves a decision snapshot and shows it, read back from the stored JSON only: the idea and its fields, the audience, the nearest alternatives (linked), what differs, the main uncertainty and the next test. Unknown parts stay visibly unknown. Later revisions don't change the view. Print shows only the snapshot, in black on white.
## Where it lives
`components/snapshot/` (index.tsx, snapshot.module.css), `tests/e2e/decision-snapshot-ui/` (AI_STUB_DIR fixtures)
## How to check it
verify: `node scripts/verify.mjs decision-snapshot-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/decision-snapshot-ui/20261010T150527Z` pass at d9504dd (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/decision-snapshot-ui/20261010T150527Z)
Run with `DATABASE_URL` set to the Neon test branch and `AI_STUB_DIR` a fresh absolute temp folder (the test copies its fixtures and writes neighbour evidence fixtures into it) and `AI_STUB_ALLOW=1`. The unchanged-after-revision check was confirmed to fail when the view re-snapshots on change. 17 neighboring e2e tests pass.
## Gaps
- No unit tests: the panel is rendering only, and the e2e covers the spec.
- The e2e snapshot has no evidence cards or challenge test, so "What differs", "Main uncertainty" and "Next test" were seen only in their empty states.
- The snapshot is kept only in the page: after a reload it's still stored, but the panel doesn't list past snapshots (share-qr links to one).
