---
name: Show the three-step demo moment for the chosen idea before sharing it
depends_on: [moment-api, share-qr-ui]
owns: [components/share/, tests/moment-ui/, tests/e2e/moment-ui/]
assignee: ""
---

# Show me the moment (F30): UI

Frontend half: Mac workers only (user decision 2026-10-10). The share panel is done, so this feature owns `components/share/` and renders inside it: no shell change. Build on the shape pinned in `moment-api`.

## Plan
1. In the share panel, above "Create a read-only link": "Show me the moment" with three numbered steps: what the judge does, what appears, and what it demonstrates; each `demonstrates` and `basis` claim shows its `ClaimBadge`.

## Requirements
- Shown only in the workspace view; the read-only `/s/:token` page never fetches or shows it.
- The share panel's own e2e still passes unchanged.

## Validation
1. Choose a version -> three numbered steps appear, each with all three parts.
2. Open the version's share link in a fresh context -> no moment section, no request to `/api/moment`.
3. `tests/e2e/moment-ui/` covers 1–2, and `tests/e2e/share-qr-ui/` still passes. Keep a screenshot.

## Defaults
Steps render as a numbered list, readable at phone width.
A stored moment loads with `GET` (no model call). When none is stored, a "Show me the moment" button generates one
with `POST`, so switching versions never triggers a model call on its own.
