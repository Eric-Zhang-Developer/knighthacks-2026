---
name: Find recent web evidence that the idea's problem is real, kept apart from evidence about solutions
depends_on: [idea-create-api, ai-client]
owns: [app/api/problem-evidence/, lib/problem-evidence/, lib/ai/grounded.ts, db/schema/problem-evidence.ts, tests/problem-evidence-api/, tests/e2e/problem-evidence-api/]
assignee: ""
---

# Problem-evidence panel (F12): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it stays unclaimed for 15 minutes. Measured by the planner on 2026-10-10 with `gemini-3.8-flash`: Google Search grounding with a `responseSchema` returned 0 grounding chunks, so it answered without searching. Grounding with no schema returned 6 web sources (redirect URI and title) and no publication dates. The plan below follows that.

## Plan
1. `lib/ai/grounded.ts`: `groundedSearch(prompt)` calls Gemini (`GEMINI_MODEL`) with the `googleSearch` tool and no `responseSchema`, and returns the text, `groundingChunks` (`uri`, `title`) and `groundingSupports` (text segment and chunk indices). Gemini only: Claude has no search grounding here. It honours the same test-stub rules as `generate`, reusing `lib/ai`'s stub reader (if that isn't exported, export it first in a `fix(ai-client)` PR).
2. `POST /api/problem-evidence/:versionId`: needs the version's `problem` (else 422 "no problem stated"). Ask for recent evidence that this problem exists. Each grounding support becomes a candidate item: its segment text and the chunk(s) it cites.
3. Resolve each chunk's redirect URI server-side to its final URL (5 s timeout; unresolved keeps `url: null` and the title). Read `publishedAt` from that page's own metadata (`article:published_time`, JSON-LD `datePublished`), else `null`.
4. One `generate` call sorts each candidate into `about: "problem" | "solution"` and writes a one-sentence `relevance` to the version's problem.
5. `eventDate`: when the grounded segment itself states a date (a year, a month and year, or a full date), the server copies that date text exactly as written; otherwise `null`. The model never supplies it.
6. Response and `GET`: `{"versionId", "problem", "items": [{"id", "claim": Claim, "about", "source": {"title", "domain", "url": string | null}, "publishedAt": string | null, "eventDate": string | null, "relevance": Claim}], "searchedAt", "model"}`.

## Requirements
- Same workspace session, same-origin and 404 rules as the other idea routes.
- Stored per version; a second `POST` returns the stored result with no outside call. Apply the table with additive SQL on the test branch and record it in `specs/decisions/<slug>-schema.md` (tech-stack: shared database schema safety); never `drizzle-kit push` from a feature branch.
- A `claim` is the grounding segment's own text and is `supported` only with its cited chunk; model text with no grounding support is dropped, never shown as evidence.
- Source, title, URL and date come only from grounding metadata and the fetched page; a date the page doesn't state stays `null` (V3 F12: date and source visible when available).
- `relevance` is `inferred`. Problem items and solution items are never merged into one list.
- A missing `GEMINI_API_KEY` or a grounding failure returns a typed 503; it never falls back to Claude or to ungrounded text.

## Validation
1. Live: `POST` for a saved version with a stated problem -> at least one `problem` item whose claim text appears verbatim in a grounding support and whose source names a domain; record the domains, dates found and model in the done note.
2. A fixture whose text has a sentence with no grounding support -> that sentence isn't an item. A fixture page with no date metadata -> `publishedAt: null`. A segment stating "in March 2025" -> `eventDate: "March 2025"`; one stating no date -> `eventDate: null`.
3. A version with `problem: null` -> 422; `GEMINI_API_KEY` unset -> 503 with no item stored.
4. `tests/e2e/problem-evidence-api/` covers 2–3 with fixtures (`AI_STUB_ALLOW=1`). Keep the stored row.

## Defaults
At most 8 items; problem items first, newest dated first, undated last.
