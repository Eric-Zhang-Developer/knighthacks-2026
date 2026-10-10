---
name: Find related GitHub repositories and Hugging Face models, Spaces and datasets, labelled by what they are
depends_on: [idea-create-api, ai-client]
owns: [app/api/research/, lib/research/, db/schema/research.ts, tests/research-api/, tests/e2e/research-api/]
assignee: ""
---

# GitHub and Hugging Face research, product versus building block (F13, F14): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it stays unclaimed for 15 minutes.

## Plan
1. `POST /api/research/:versionId`: through `lib/ai/`, derive up to 3 short search queries from the version's fields. For each, keep the full query for GitHub's repository search (`https://api.github.com/search/repositories`, 5 per query, no token) and the Hugging Face Hub search for models, Spaces and datasets (`https://huggingface.co/api/{models,spaces,datasets}?search=`, 5 each; `HF_TOKEN` sent if set). For HF only, search up to two distinct single terms per query: lowercase, remove common connecting words, prefer longer terms (ties preserve query order), and deduplicate source/term calls across queries. Deduplicate by URL; keep at most 12.
2. One more `lib/ai/` call classifies each returned item by its `id`: `direct-alternative`, `adjacent`, `research` or `building-block`, with a one-sentence `reason`.
3. Response and `GET`: `{"versionId", "queries": [string], "items": [{"id", "source": "github" | "hf-model" | "hf-space" | "hf-dataset", "name", "url", "description": string | null, "popularity": {"metric": "stars" | "likes" | "downloads", "value"} | null, "updatedAt": string | null, "kind", "reason": Claim}], "unavailable": [{"source", "status"}], "searchedAt"}`.

## Requirements
- Same workspace session, same-origin and 404 rules as the other idea routes.
- Stored per version; a second `POST` returns the stored result with no outside call. Apply the table with additive SQL on the test branch and record it in `specs/decisions/<slug>-schema.md` (tech-stack: shared database schema safety); never `drizzle-kit push` from a feature branch.
- Every item field except `kind`, `reason` and a Hugging Face `url` is copied from the API response as returned; missing is `null`, never filled in (V3 F13: provenance). Hugging Face search returns ids, not URLs, so the server builds them from the id: `https://huggingface.co/<id>`, `/spaces/<id>`, `/datasets/<id>`.
- Nothing is cloned, installed, downloaded or executed; the server calls only the search endpoints above (V3 F13).
- An `hf-model` or `hf-dataset` item is never `direct-alternative`: the server rewrites it to `building-block` (V3 F14: a model library is not proof the product exists).
- A classification naming an `id` that the APIs didn't return is dropped. The server sets each `reason`'s `sourceIds` to exactly `[its item id]`, discarding whatever the model cited (`checkClaims` alone keeps unknown ids), and its label is at most `inferred`.
- A source answering 403 or 429 is listed in `unavailable` with its status; the rest still return.

## Validation
1. Fixtures (`AI_STUB_ALLOW=1`) and recorded search responses -> items keep the recorded names, URLs and popularity exactly; a fixture labelling an `hf-model` `direct-alternative` stores `building-block`; a fixture classifying an unknown `id` drops it. `POST` again -> the same row, no outside call.
2. A recorded GitHub 403 -> GitHub listed in `unavailable`, Hugging Face items still returned.
3. One live run against the real GitHub and Hugging Face APIs for a saved version -> at least one item, every item's `url` on `github.com` or `huggingface.co`; zero items from every source fails. A source with no matches is fine; an AI-shaped multiword query must return at least one Hugging Face item. Record the queries, count per source and any `unavailable` in the done note.
4. `tests/e2e/research-api/` covers 1–2. Keep the stored row.

## Defaults
Popularity: GitHub stars; Hugging Face likes. Items ordered direct alternatives first, then adjacent, research, building blocks.
