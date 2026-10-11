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
4. Search bar UI: results list; sets `highlightedIds`; clearing restores the previous selection. The results panel
   folds away when a result is picked, on a click outside the bar and panel, and on Escape, keeping the query and
   highlights; focusing the box, typing or changing a filter shows it again. With it folded, Escape clears the query.

## Requirements
- Similarity is cosine in embedding space, never 3D distance.
- On an embedding API failure, show text matches with "meaning search unavailable", not an error page.
- `q` limited to 500 characters; validated with zod.

## Validation
1. `curl '/api/search?q=<a fixture title>'` -> that project first.
2. Type a query in the bar -> results list and the same stars highlighted; clear -> highlights gone. Pick a result,
   click the map or press Escape -> the panel folds away; click the box -> it's back.
3. `tests/e2e/search/` covers 2. Keep the response JSON and a screenshot.

## Defaults
k = 10. Text match is case-insensitive substring on title.
