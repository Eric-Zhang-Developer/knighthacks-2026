## What shipped
Stored workflow-step comparison against the saved top cosine neighbor, labelled source-grounded claims, one result per version, and empty points without generation when workflow is missing.
## Where it lives
`app/api/alternative/`, `lib/alternative/`, `db/schema/alternative.ts`, `tests/strongest-alternative-api/`, `tests/e2e/strongest-alternative-api/`.
## How to check it
verify: `node scripts/verify.mjs strongest-alternative-api "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\strongest-alternative-api\20261010T150929Z"` pass at 4b97784. Real Neon/HF with generation fixtures; concurrent first requests retained one row, fixture removal proved cached/missing-workflow generation bypass, and workspace isolation passed. 180 unit tests passed.
## Gaps
Production schema awaits #113; no deployed/live-generation/user trial claimed. Corpus alternatives only; workflow action phrases must quote the saved text. Test table applied with additive SQL as required. No Validation step skipped.
