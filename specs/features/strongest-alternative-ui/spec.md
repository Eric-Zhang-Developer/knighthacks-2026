---
name: See the strongest existing alternative beside the evidence cards
depends_on: [strongest-alternative-api, neighbor-evidence-ui]
owns: [components/evidence/, tests/strongest-alternative-ui/, tests/e2e/strongest-alternative-ui/]
assignee: ""
---

# Strongest existing alternative (F26): UI

Frontend half: Mac workers only (user decision 2026-10-10). The evidence panel is done, so this feature owns
`components/evidence/` and renders the alternative inside it: no shell change. Build on the shape pinned in
`strongest-alternative-api`.

## Plan
1. Above the evidence cards for `activeIdeaVersionId`: the strongest alternative's title and source link, then its
   points, each tied to a workflow step and showing its `ClaimBadge`.
2. `missingWorkflow` -> a prompt to add the workflow to the idea, not an empty panel.

## Requirements
- Every claim shows its label as text; loading and failure use `PanelState`.
- The evidence cards' own e2e still passes unchanged.

## Validation
1. Save an idea -> the alternative appears with its source link, and every point shows a step and a label.
2. An idea with no workflow -> the add-workflow prompt.
3. `tests/e2e/strongest-alternative-ui/` covers 1–2, and `tests/e2e/neighbor-evidence-ui/` still passes. Keep a
   screenshot.

## Defaults
Collapsed to the title and first point; expand for the rest.
