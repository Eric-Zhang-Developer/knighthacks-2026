## What shipped
Workspace-scoped comparisons of two or three saved versions across the event rubric, with evidence-grounded Claim reasons and qualitative uncertainty; concise prose reduces live generation time without changing criteria, citations, validation or provider budget.
## Where it lives
`app/api/compare/`, `lib/compare/`, `tests/compare-api/`, `tests/e2e/compare-api/`; contract in `specs/decisions/compare-api-contract.md`.
## How to check it
verify: `node scripts/verify.mjs compare-api "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\compare-api\20261010T182819Z"` pass at dc73182 (uncommitted changes); tracked source was clean, only unrelated untracked `reports/deploys.md` existed. 278 unit tests, typecheck, lint and gates passed.
## Gaps
Canonical generation used fixtures with real TEST Neon/HF. One saved-input live Gemini replay passed in 24,258ms after the unchanged prompt timed out at 29,690ms; this is not a reliability claim or a full live-smoke pass (#170). Existing deployment-only Foreman test skipped. Source provenance is not semantic truth; missing cards yield inferred reasons. No production changes or user trial.
