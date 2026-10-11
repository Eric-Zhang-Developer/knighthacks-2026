# corpus-embed: HNSW ef_search 400 at 76k rows

Context: the golden test (`order by embedding <=> q limit 1`, which uses the HNSW index) returned the wrong project
first at pgvector's default `hnsw.ef_search` of 40 for 2 of 5 fixture titles at 57,488 rows, and at 200 for 1 of 5
("greghouse") at 76,316 rows. An exact scan returned the right record every time, and so did the index at 400 or
1000 (5 of 5). Median index query time on the test branch: 304 ms at 200, 274 ms at 400 (network dominates).

Options: A. `alter database ... set hnsw.ef_search = 400`. B. Set it per query in every caller. C. Make every
neighbour query exact, as search already is (#257).

Choice: A, applied by the release load on test and production. It fixes every index-ordered neighbour query
(branches and revisions placement too) without touching their code. Neon's pooler reuses server sessions, so a
session opened before the change keeps the old value until it is recycled; release checks use a direct connection.
Revisit (likely C or a higher value) as the corpus grows past ~100k.

How to undo: `alter database <db> reset hnsw.ef_search`.
