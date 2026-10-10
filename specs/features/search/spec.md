---
name: Search the corpus by meaning or text and highlight the results in the galaxy
depends_on: [corpus-embed]
owns: [app/api/search/, lib/search/, components/search/, tests/search/, tests/e2e/search/]
assignee: ""
---

# Search (F19)

## Plan
1. `lib/search/embed.ts`: embed a string through the Hugging Face Inference API (`EMBED_MODEL`).
2. `lib/search/neighbors.ts`: top-k by pgvector cosine, with optional filters (event, year). Ideas reuse this.
3. `GET /api/search?q=&event=&year=` -> results with `similarity`, plus text matches on title.
4. Search bar UI: results list; sets `highlightedIds`; clearing restores the previous selection.

## Requirements
- Similarity is cosine in embedding space, never 3D distance.
- On an embedding API failure, show text matches with "meaning search unavailable", not an error page.
- `q` limited to 500 characters; validated with zod.

## Validation
1. `curl '/api/search?q=<a fixture title>'` -> that project first.
2. Type a query in the bar -> results list and the same stars highlighted; clear -> highlights gone.
3. `tests/e2e/search/` covers 2. Keep the response JSON and a screenshot.

## Defaults
k = 10. Text match is case-insensitive substring on title.
