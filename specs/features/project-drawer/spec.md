---
name: Open any star's project record with its source link
depends_on: [corpus-embed, galaxy]
owns: [app/api/projects/, components/drawer/, tests/project-drawer/, tests/e2e/project-drawer/]
assignee: ""
---

# Project drawer (F01)

## Plan
1. `GET /api/projects/:id` -> the record from `projects`.
2. Drawer in the right column when `selectedProjectId` is set: title, tagline, events, date (or "date unknown"),
   technologies, description excerpt, and a link to the source page.

## Requirements
- Every drawer shows the source link; a missing field shows as unknown, never blank-filled.
- Unknown ID -> 404 and the drawer says "not found".

## Validation
1. Click a star -> the drawer opens with that project; the source link's URL equals the record's `url`.
2. `tests/e2e/project-drawer/` covers 1. Keep a screenshot.

## Defaults
Excerpt = first 400 characters of the description.
