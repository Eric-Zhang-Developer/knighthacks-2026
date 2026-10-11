## What shipped
76,316 real records (from 57,301), normalized BAAI/bge-m3 vectors and the star-systems layout (#301), version `2026-10-11-76316`. 302 records with no visible title or under 40 visible description characters were set aside before the layout (near-empty text embeds as a "hub" that outranks real projects). The database default `hnsw.ef_search` is 400: the default 40 missed 2 of 5 golden titles at 57k, 200 missed 1 at 76k, and 400 found all 5.
## Where it lives
`corpus/embed/`, `db/schema/corpus.ts`, `public/corpus/stars.json`, `specs/decisions/corpus-embed-index-rebuild.md`, `specs/decisions/corpus-embed-ef-search.md`.
## How to check it
not verified by verify.py for this release. Test branch, 2026-10-11 ~07:50 EDT, direct connection: `corpus/release/check.py` printed "count 76316, corpus_version 2026-10-11-76316, passed", and `pytest corpus/embed/test_embed.py corpus/embed/test_layout.py` gave 5 passed, twice. Production: the same checks after a rollback copy (receipt in #262). `stars.json` sha256 `8e34fd5478d6e24b710257b5c0a1496dde21127a241f8b96fd002f54d93ab8c7`.
## Gaps
The junk filter runs at release, not in `corpus/fetch`. Pooled sessions opened before the `ef_search` change keep the old value until Neon recycles them, so index-ordered neighbour queries (branches, revisions) may briefly use 200; search is an exact scan (#257) and unaffected. `classes.json` keys the previous version until corpus-classify labels the ~19k new ids and rebuilds it. The ~101k gallery-only cards aren't published. Year is project creation year.
