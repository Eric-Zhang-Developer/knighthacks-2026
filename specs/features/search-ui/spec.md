---
name: Search bar that highlights results in the galaxy
depends_on: [search-api, galaxy]
owns: [components/search/, tests/search-ui/, tests/e2e/search-ui/]
assignee: ""
---

# Search (F19): UI

Frontend half: Mac workers only (user decision 2026-10-10). Build against the response shape pinned in `search-api`; the routes exist once it is done.

## Plan
1. Search bar in the top region: calls `/api/search`, shows a results list.
2. Sets `highlightedIds`; clearing restores the previous selection.

## Requirements
- With `meaningSearch: "unavailable"`, show the text matches and the words "meaning search unavailable", not an error page.
- Keyboard reachable: type, arrow through results, Enter selects.

## Validation
1. Type a query in the bar -> results list and the same stars highlighted; clear -> highlights gone.
2. `tests/e2e/search-ui/` covers 1. Keep a screenshot.

## Defaults
Debounce typing by 250 ms.
