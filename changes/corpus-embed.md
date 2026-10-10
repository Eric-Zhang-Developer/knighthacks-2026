## What shipped
`corpus/embed/run.py` embeds records with `BAAI/bge-m3` via the HF Inference API (cached by content hash), projects them to 3D with UMAP (cosine, seed 42), replaces the Neon `projects` table (pgvector, HNSW cosine index) in one transaction, and writes `public/corpus/stars.json`. Loaded now: the 100-record real fixture, `corpus_version 2026-10-10-100`.
## Where it lives
`corpus/embed/`, `db/schema/corpus.ts`, `public/corpus/stars.json`, `specs/decisions/corpus-embed-vectors.md`
## How to check it
verify: `node scripts/verify.mjs corpus-embed /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/corpus-embed/20261010T103647Z` pass at d0b29ed (uncommitted changes) (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/corpus-embed/20261010T103647Z)
Golden: 5 fixture titles each return their own record first via pgvector; `stars.json` count = table count = 100. Parity python vs js: cosine 1.000000 x5.
## Gaps
- Full corpus not loaded yet: the fetch runs until 16:00 EDT, then rerun `run.py` and commit the new `stars.json` (a `fix(corpus-embed)` PR).
- HF cost per record not measured: about 115 embeddings so far against $5 of credits; check the billing page before the full run.
- `pnpm db:push` doesn't read `.env.local` (the shell can't source a URL with `&`); use `node --env-file=.env.local node_modules/drizzle-kit/bin.cjs push`.
- `year` in `stars.json` is the project's created year (Devpost shows no submission date). One Neon database, no dev/test branches.
