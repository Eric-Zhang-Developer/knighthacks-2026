---
name: Return any corpus project's record by ID
depends_on: [corpus-embed]
owns: [app/api/projects/, tests/project-drawer-api/, tests/e2e/project-drawer-api/]
assignee: ""
---

# Project drawer (F01): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it stays unclaimed for 15 minutes, so the backend chain never waits on one machine.

## Plan
1. `GET /api/projects/:id` -> `{"id", "url", "title", "tagline", "description", "technologies", "events", "date", "date_kind"}` from `projects`; a field the record lacks is `null`.

## Requirements
- Unknown ID -> 404 `{"error": "not found"}`.
- Never fills a missing field.

## Validation
1. `curl /api/projects/<fixture id>` -> its record, `url` equal to the fixture's; an unknown ID -> 404.
2. `tests/e2e/project-drawer-api/` covers 1. Keep the response.

## Defaults
No pagination; one record per call.
