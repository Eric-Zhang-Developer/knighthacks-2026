## What shipped
HF BAAI/bge-m3 embeddings, UMAP coordinates and transactional Neon loading; requests now have a 60-second inactivity timeout (one retry), and every completed batch is atomically cached for recovery. Production remains the original 100-record fixture, version 2026-10-10-100.
## Where it lives
`corpus/embed/`, `db/schema/corpus.ts`, `public/corpus/stars.json`, `specs/decisions/corpus-embed-vectors.md`.
## How to check it
verify: `node scripts/verify.mjs corpus-embed /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/corpus-embed/20261010T133706Z` pass at 00619c2 (uncommitted changes) (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/corpus-embed/20261010T133706Z). Six checks pass: five live title queries return their fixture records, test-Neon/bundle count is 100, provider timeout/retry and cache recovery work. Historical Python/JS parity: cosine 1.000000 x5.
## Gaps
The 8,409-record full release is unshipped and frozen after idea-create-api merged (#63); HF cost per record is unknown. Recovery verified with a local silent HTTP provider and a real fixture load on the dedicated test database, not a full production rerun. Year is project creation year; schema push still requires explicitly loading .env.local.
