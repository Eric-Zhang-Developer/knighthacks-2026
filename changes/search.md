## What shipped
Search bar in the header: `GET /api/search?q=&event=&year=` returns the 10 nearest projects by pgvector cosine on the query's `BAAI/bge-m3` embedding (with `similarity`), plus case-insensitive title matches; the bar lists both and writes their ids to `highlightedIds`. Clearing drops the highlights and restores the selection from before the search. If Hugging Face fails, title matches still show with "Meaning search unavailable". `q` is zod-validated, 1–500 characters.
## Where it lives
`app/api/search/route.ts`, `lib/search/` (`embed.ts`, `neighbors.ts` for ideas to reuse, `highlight.ts`), `components/search/`, `tests/search/`, `tests/e2e/search/`
## How to check it
verify: `node scripts/verify.mjs search /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/search/20261010T105615Z` pass at 896e03e (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/search/20261010T105615Z)
## Gaps
- Stars lighting up is not checked end to end: galaxy (#37) isn't merged. Search sets `highlightedIds`, which galaxy's `Scene.tsx` reads; re-check once both are on main.
- The e2e test runs against the shared Neon database with the 100-record fixture corpus; the full corpus load may change neighbor order but not "own title first".
- No UI for the `event`/`year` filters; the API supports them. One Hugging Face call per query (debounced 300 ms), no cache.
