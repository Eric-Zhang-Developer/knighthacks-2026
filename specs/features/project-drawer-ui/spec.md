---
name: Open any star's project record with its source link
depends_on: [project-drawer-api, galaxy]
owns: [components/drawer/, tests/project-drawer-ui/, tests/e2e/project-drawer-ui/]
assignee: ""
---

# Project drawer (F01): UI

Frontend half: Mac workers only (user decision 2026-10-10). Build against the response shape pinned in `project-drawer-api`; the routes exist once it is done.

## Plan
1. Drawer in the right column when `selectedProjectId` is set: title, tagline, events, date (or "date unknown"), technologies, description excerpt, and a link to the source page.

## Requirements
- Every drawer shows the source link; a missing field shows as unknown, never blank-filled.
- A 404 shows "not found" in the drawer.

## Validation
1. Click a star -> the drawer opens with that project; the source link's URL equals the record's `url`.
2. `tests/e2e/project-drawer-ui/` covers 1. Keep a screenshot.

## Defaults
Excerpt = first 400 characters of the description.
