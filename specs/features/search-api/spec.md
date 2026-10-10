---
name: Search the corpus by meaning or text through one API
depends_on: [corpus-embed]
owns: [app/api/search/, lib/search/, tests/search-api/, tests/e2e/search-api/]
assignee: ""
---

# Search (F19): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it stays unclaimed for 15 minutes, so the backend chain never waits on one machine.

## Plan
1. `lib/search/embed.ts`: embed a string through the Hugging Face Inference API (`EMBED_MODEL`).
2. `lib/search/neighbors.ts`: top-k by pgvector cosine, with optional filters (event, year). Ideas reuse this.
3. `GET /api/search?q=&event=&year=` -> `{"results": [{"id", "title", "event", "year", "similarity"}], "textMatches": [{"id", "title"}], "meaningSearch": "ok" | "unavailable"}`.

## Requirements
- Similarity is cosine in embedding space, never 3D distance.
- On an embedding API failure, return text matches with `meaningSearch: "unavailable"` and status 200.
- `q` limited to 500 characters; validated with zod (400 otherwise).

## Validation
1. `curl '/api/search?q=<a fixture title>'` -> that project first.
2. With the embedding call failing (stubbed in the test only) -> text matches and `"unavailable"`.
3. `tests/e2e/search-api/` covers 1–2 through Playwright's request API. Keep the response JSON.

## Defaults
k = 10. Text match is case-insensitive substring on title.
