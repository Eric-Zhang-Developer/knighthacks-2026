# corpus-embed: HNSW ef_search 200 at 57k rows

Context: at the 57,488-row test load, the golden test (`order by embedding <=> q limit 1`, which uses the HNSW index)
returned the wrong project first for 2 of 5 fixture titles at pgvector's default `hnsw.ef_search` of 40. An exact
scan returned the right record for both, and so did the index at `ef_search` 200 or 400 (5 of 5).

Options: A. `alter database ... set hnsw.ef_search = 200`. B. Set it per query in every caller. C. Make every
neighbour query exact, as search already is (#257).

Choice: A, applied by the release load on test and production. It fixes every index-ordered neighbour query
(branches and revisions placement too) without touching their code. Note: Neon's pooler reuses server sessions,
so a session opened before the change keeps 40 until it reconnects.

How to undo: `alter database <db> reset hnsw.ef_search`.
