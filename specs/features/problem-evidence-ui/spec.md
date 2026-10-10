---
name: Check whether the idea's problem is real, with dated, sourced evidence
depends_on: [problem-evidence-api, idea-create-ui]
owns: [components/idea/, tests/problem-evidence-ui/, tests/e2e/problem-evidence-ui/]
assignee: ""
---

# Problem-evidence panel (F12): UI

Frontend half: Mac workers only (user decision 2026-10-10). The idea card is done, so this feature owns `components/idea/` and renders inside it: no shell change. Build on the shape pinned in `problem-evidence-api`.

## Plan
1. Under the idea card's problem field: "Is this problem real?" runs the search for `activeIdeaVersionId`, then lists problem items first. Each shows its claim with a `ClaimBadge`, the source title and domain (linked when `url` is set), its published date or "date not given", the event date when set, and its relevance with a `ClaimBadge`.
2. Solution items sit under a separate heading, "About solutions, not the problem".

## Requirements
- "Searched the web on <searchedAt>" is always shown; no item reads as verified beyond its label.
- Loading and failure use `PanelState`; a 422 says the idea has no problem stated yet.
- The idea card's own e2e still passes unchanged.

## Validation
1. Save an idea with a problem -> run the check -> problem items show source, date or "date not given", and labels; solution items sit under their own heading.
2. An idea with no problem -> the 422 message, no request loop.
3. `tests/e2e/problem-evidence-ui/` covers 1–2 with fixtures, and `tests/e2e/idea-create-ui/` still passes. Keep a screenshot.

## Defaults
Collapsed to three problem items; expand for the rest.
