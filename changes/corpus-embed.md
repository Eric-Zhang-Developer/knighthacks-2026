## What shipped
57,301 real records (from 8,409), normalized BAAI/bge-m3 vectors and the star-systems layout (#301), version `2026-10-11-57301` (#262). 187 records with no visible title or under 40 visible description characters were dropped at release: near-empty text embedded as a "hub" that outranked real projects. The database default `hnsw.ef_search` is 200: at 57k rows the default 40 missed 2 of 5 golden titles, and 200 found all 5.
## Where it lives
`corpus/embed/`, `db/schema/corpus.ts`, `public/corpus/stars.json`, `specs/decisions/corpus-embed-index-rebuild.md`, `specs/decisions/corpus-embed-ef-search.md`.
## How to check it
not verified by verify.py for this release. Test branch at 2026-10-11 03:4x EDT: `corpus/release/check.py` printed "count 57301, corpus_version 2026-10-11-57301, passed", and `pytest corpus/embed/test_embed.py corpus/embed/test_layout.py` gave 5 passed. Production: the same check and golden tests, run after a rollback copy (receipts in #262). `stars.json` sha256 `0dac4d9e4625df83bab6fdf6a749c5027b2eb2f1a2c1f43486a9c26d0263ec7d`.
## Gaps
The junk filter ran once at release, not in `corpus/fetch` (a `fix(corpus-fetch)` should reject such pages). Search uses an exact scan (#257), which measured ~0.8 s per query at 57k on the test branch, up from 36 ms at 8,409. `classes.json` (corpus-classify) still keys the previous `corpus_version` until it's re-run. The resumed fetch continues past this release; the ~101k gallery-only cards aren't published. Year is project creation year.
