---
name: Filter search by event and year, and label years as created years
depends_on: [search, galaxy-history]
owns: [components/search/, tests/search-filters-ui/, tests/e2e/search-filters-ui/]
assignee: ""
---

# Search filters (F19 polish)

Frontend: Mac workers. The search API already takes `event` and `year`; nothing in the page sets them (search Gaps).
Results label a project's year as if it were the event's ("<event> · 2026"), but `year` is the Devpost page's created
year (galaxy-history Gaps).

## Plan
1. Two filters beside the search box: event (the events `stars.json` names, with counts) and year (the years present).
2. Results and star highlights use the filters; clearing them restores the previous query's results.
3. Result meta reads `<event> · created <year>`.

## Requirements
- Filter options come from the committed `stars.json`, never a hard-coded list; an event with no projects isn't offered.
- The filters are native `<select>` elements with labels, reachable by keyboard.
- Changing a filter keeps the typed query; an empty query with a filter lists that filter's projects.

## Validation
1. Search a word, pick an event -> every result and highlighted star is from that event.
2. Pick a year -> every result shows `created <year>` with that year.
3. Clear both -> the unfiltered results return.
4. `tests/search-filters-ui/` pins option building from a `stars.json` fixture.

## Defaults
More than 30 events -> sort by count and show all in the select.
Under an event filter, results are labelled with that event (a project can be in several; see
`specs/decisions/search-filters-ui-multi-event.md`). An empty-query filter lists its first 50 projects and highlights
all of them. On desktop the event select is capped at 140px so the search box keeps its width inside the header's
560px search column.
