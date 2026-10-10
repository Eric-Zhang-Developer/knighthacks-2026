## What shipped
Event and year `<select>` filters beside the search box, built from `public/corpus/stars.json` (events by project count with counts shown, created years newest first). The query is kept when a filter changes; results and star highlights follow the filters; clearing both brings back the unfiltered results. An empty query with a filter lists that filter's projects (first 50 shown, all highlighted) with no request. Results read `<event> · created <year>`, and under an event filter show that event even when it is a project's second event.
## Where it lives
`components/search/` (`filters.ts`, `index.tsx`, `search.module.css`), `tests/search-filters-ui/`, `tests/e2e/search-filters-ui/`; `specs/decisions/search-filters-ui-multi-event.md`.
## How to check it
verify: `node scripts/verify.mjs search-filters-ui .git/agent-evidence/search-filters-ui/20261010T191220Z` pass at e20edc2 (Mac; real search API and live embedding on the Neon test branch, 8,409 projects; responses and list labels checked for event and year; keyboard order; screenshot `filters.png`). Whole page checked at 1280, 1440 and 390 wide: no horizontal overflow.
## Gaps
Highlighted stars are set from the same ids as the list but aren't inspected on the canvas. Option counts and the empty-query list use each project's first event only (stars.json has no more). The header's search column (560px, shell-owned) keeps the input at ~290px beside the filters. `tests/e2e/search` fails on main independently (#253).
