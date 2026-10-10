## What shipped
Suggest up to three distinct directions; accepted and manual alternatives become immutable sibling versions. Accepted retries are idempotent and all reads/writes are workspace scoped.
## Where it lives
`app/api/branches/`, `lib/branches/`, `tests/branches-api/`, `tests/e2e/branches-api/`; payload/storage contract in `specs/decisions/branches-api-contract.md`.
## How to check it
verify: `node scripts/verify.mjs branches-api /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/branches-api/20261010T142823Z` pass at 22fd412 (uncommitted changes) (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/branches-api/20261010T142823Z)
## Gaps
Verified implementation committed as 45a3719: test Neon, real HF embeddings, test-only generation fixture; no live generation-provider quality check or user trial. All spec Validation steps passed; 141 unit tests, typecheck, lint, ownership, gates and markers passed. Corpus remains frozen.
