## What shipped
Workspace-scoped comparisons of two or three saved versions across the event rubric, with evidence-grounded Claim reasons and explicit qualitative uncertainty; no numeric scoring or persisted mutations.
## Where it lives
`app/api/compare/`, `lib/compare/`, `tests/compare-api/`, `tests/e2e/compare-api/`; contract in `specs/decisions/compare-api-contract.md`.
## How to check it
verify: `node scripts/verify.mjs compare-api /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/compare-api/20261010T144046Z` pass at 1808261 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/compare-api/20261010T144046Z)
## Gaps
All spec Validation passed on test Neon with real HF embeddings and generation-only fixtures; 152 unit tests and required local checks passed. Live generation quality and user trials remain unverified. Citation membership/excerpt checks establish provenance, not semantic truth; missing cards yield inferred reasons. Opaque IDs retain their real digits.
