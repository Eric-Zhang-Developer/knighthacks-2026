## What shipped
Workspace-authorized immutable decision snapshots: explicit idea/evidence/test fields, fresh ID per choice, stored JSON-only reads, and no private challenge answers.
## Where it lives
`app/api/snapshots/`, `lib/snapshots/`, `db/schema/snapshots.ts`, `tests/decision-snapshot-api/`, `tests/e2e/decision-snapshot-api/`.
## How to check it
verify: `node scripts/verify.mjs decision-snapshot-api "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\decision-snapshot-api\20261010T142218Z"` pass at 4774935. Real Neon/HF, generation fixtures; byte-identical GET after revision, private-field exclusion, workspace isolation and fresh choices passed; 139 unit tests passed.
## Gaps
Production schema awaits #113; no deployed or user trial claimed. Tests are ordered by newest challenge session then round because rounds have no timestamps. Unknown evidence stays empty/null. No Validation step skipped.
