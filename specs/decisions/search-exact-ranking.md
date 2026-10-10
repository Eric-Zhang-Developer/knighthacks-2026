# Exact cosine ranking for the released corpus

Context: #253 reproduced twice on main eaceb5a (empty claim commit ac20c5c): the unchanged live search golden expected greghouse but returned Writers Room Greenlight. With the same live query embedding, HNSW returned cosine 0.44430754584535215; exact ordering found greghouse first at 0.5732482159213891. The golden expectation remains valid.

Options: tune approximate HNSW recall, or order all matching rows by exact cosine. Choose exact ranking for the frozen 8,409-record corpus, including filtered requests and idea callers of neighbors(). ORDER BY distance + 0 preserves cosine ordering while preventing use of the approximate distance index; EXPLAIN confirmed a sequential scan and top-N sort. [pgvector documents the index ordering requirement](https://github.com/pgvector/pgvector#troubleshooting).

Read-only TEST_DATABASE_URL benchmark: five EXPLAIN ANALYZE runs per query and strategy using identical saved live embeddings, warm buffers, excluding embedding/network latency. DAVE: indexed median 1.039 ms (1.028–1.068), exact 61.727 ms (61.294–72.952). Brailliant: indexed 1.118 ms (1.109–1.220), exact 62.077 ms (60.491–68.658). greghouse: indexed 0.691 ms (0.682–0.721), exact 62.607 ms (59.971–64.610). No concurrency/load benchmark; full scans grow with corpus size. Revisit only with measured latency and recall coverage.

Undo: remove the + 0 expression to restore approximate ordering, which also restores the demonstrated recall risk. No index, schema, stored vectors, star coordinates or frontend changed. Raw plans, vectors and both failing verification logs are retained under .git/agent-evidence/search-recall/20261010.
