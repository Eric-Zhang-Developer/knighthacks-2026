---
name: See joined workflows that combine two real neighbor projects
depends_on: [combinations-api, strongest-alternative-ui]
owns: [components/evidence/, tests/combinations-ui/, tests/e2e/combinations-ui/]
assignee: ""
---

# Meaningful combinations (F28): UI

Frontend half: Mac workers only (user decision 2026-10-10). The evidence panel is done, so this feature owns `components/evidence/` and renders inside it: no shell change. Build on the shape pinned in `combinations-api`.

## Plan
1. Below the evidence cards for `activeIdeaVersionId`: "Combine ideas" lists each suggestion's user, benefit and workflow steps, with both source projects linked (drawer and source page) and every claim's `ClaimBadge`.

## Requirements
- Both source projects are always visible and linked; no suggestion shows without them.
- Loading and failure use `PanelState`. The evidence cards' and strongest alternative's e2e still pass.

## Validation
1. Save an idea -> suggestions appear; each shows two linked source projects and labelled claims.
2. Click a source -> the drawer opens on that project.
3. `tests/e2e/combinations-ui/` covers 1–2, and `tests/e2e/neighbor-evidence-ui/` and `tests/e2e/strongest-alternative-ui/` still pass. Keep a screenshot.

## Defaults
Collapsed to the first suggestion; expand for the rest.
