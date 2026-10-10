## What shipped
8,409 real records, normalized BAAI/bge-m3 vectors and a matching UMAP bundle, version `2026-10-10-8409`; full loads rebuild HNSW within the replacement transaction to preserve golden-search recall.
## Where it lives
`corpus/embed/`, `db/schema/corpus.ts`, `public/corpus/stars.json`, `specs/decisions/corpus-embed-index-rebuild.md`.
## How to check it
verify: `node scripts/verify.mjs corpus-embed /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/corpus-embed/20261010T172921Z` pass at abf64d9 (uncommitted changes). All six checks passed against the full test database; five title queries returned their fixture records first, and table/bundle count and version matched.
## Gaps
Production publication and deployed-galaxy verification are coordinated by corpus-release (#62), with a saved rollback and no saved-idea replacement. Historical fetch totals and provider cost are unknown; this checkpoint release performs no new discovery. Year is project creation year. Corpus freezes after this one approved publication.
