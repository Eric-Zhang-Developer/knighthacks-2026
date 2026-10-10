# Rebuild HNSW after replacing the corpus

The first 8,409-record test load passed count/version/source validation but failed the unchanged title-search golden test: `greghouse` returned `Writers Room Greenlight`. A second read-only diagnosis reproduced that miss. Exact cosine search returned `greghouse` first (distance 0.426752 versus 0.555692), demonstrating an approximate-index miss rather than bad vectors.

Rebuilding the existing `projects_embedding_hnsw` index and analyzing `projects` took 7.63 seconds on the test database; all 20 corpus/release checks then passed, including all five golden title queries. The loader now performs those two maintenance statements within its existing replacement transaction. No model, records, queries, golden expectations, index definition or layout algorithm changes. Undo by reverting these statements; the index is derived data, with original corpus rollback files retained for this publication.
