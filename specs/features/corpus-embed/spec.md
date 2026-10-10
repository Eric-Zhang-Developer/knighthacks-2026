---
name: Embed the corpus, project it to 3D, load it into Neon and export star coordinates
depends_on: [corpus-fetch]
owns: [corpus/embed/, db/schema/corpus.ts, public/corpus/]
assignee: ""
---

# Corpus embed

## Plan
1. `corpus/embed/` script: read `projects.jsonl`; embed `title + tagline + description` with `BAAI/bge-m3`
   (dense, normalized).
2. UMAP to 3D (cosine metric, fixed seed); scale to a unit cube.
3. `db/schema/corpus.ts`: table `projects` (record fields + `embedding vector(1024)`, `x`, `y`, `z`,
   `corpus_version`) with an HNSW `vector_cosine_ops` index. Upsert all rows.
4. Write `public/corpus/stars.json`: `{"corpus_version", "count", "stars": [{"id", "x", "y", "z", "title",
   "event", "year"}]}`.

## Requirements
- The vector for a text must match what the app gets at request time from the Hugging Face Inference API for
  the same model: cosine >= 0.99 on 5 sample texts. Record the result in
  `specs/decisions/corpus-embed-vectors.md`.
- `corpus_version` is the date plus the record count; `stars.json` and the table carry the same one.
- `count` in `stars.json` equals the rows loaded.

## Validation
1. Run it on `corpus/fixtures/sample.jsonl` -> prints rows loaded and the version; `stars.json` has that count.
2. Golden test (`pytest corpus/embed`): for 5 fixture records, querying with the record's own title returns that
   record first, by pgvector cosine.
3. `select count(*) from projects` equals `count`. Keep: the printed lines and the query output.

## Defaults
Embed locally or through the Inference API, whichever is faster; the parity check decides if it's valid.
