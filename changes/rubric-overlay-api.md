## What shipped
Immutable per-version overlays for all 28 canonical tracks, quoted idea intent, labelled speculation, and separately editable user proof; repeated/concurrent generation preserves proofs.
## Where it lives
`app/api/rubric/`, `lib/rubric/`, `db/schema/rubric.ts`, `tests/rubric-overlay-api/`, `tests/e2e/rubric-overlay-api/`; contract in `specs/decisions/rubric-overlay-api-contract.md`.
## How to check it
`verify: node scripts/verify.mjs rubric-overlay-api "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\rubric-overlay-api\20261010T160521Z"` pass at 8c7f9a9; typecheck/lint and 226 unit tests pass; canonical HTTP test retains the successful overlay/proof row.
## Gaps
Generation used explicit fixtures; Neon and Hugging Face embeddings were real. Live provider output and production deployment were not verified. User proof is not independently certified; prose filters have semantic limits documented in the decision. No specified Validation step skipped; frontend belongs to rubric-overlay-ui.
