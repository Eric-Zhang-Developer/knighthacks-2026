---
name: Rehearse the pitch in the share panel: list what works, read the draft, face three questions
depends_on: [rehearsal-api, moment-ui]
owns: [components/rehearsal/, components/share/, tests/rehearsal-ui/, tests/e2e/rehearsal-ui/]
assignee: ""
---

# Demo rehearsal (F18): UI

Frontend: Mac workers. Renders below the moment in the share panel.

## Plan
1. A "Rehearse" section: a list input for what works now (add, edit, remove; 1–8 items), then "Draft pitch".
2. The pitch reads as sentences, each marked Built or Planned with `ClaimBadge`-style labels; then the three
   questions, each with its weakness and basis badge.

## Requirements
- Built and Planned are text labels, not color alone.
- While the draft is generating, the button reads "Drafting…" and is disabled; a 502 shows "Couldn't draft the
  pitch. Try again." and keeps the list.
- Renders only in the workspace view; `/s/:token` never shows it.

## Validation
1. Add two items, Draft -> a pitch with Built and Planned labels and three questions.
2. Reload -> the stored rehearsal for the active version shows without a new request to `POST`.
3. API fails (route stubbed to 502) -> the error line, the list kept.
4. `/s/:token` for the same snapshot -> no Rehearse section.

## Defaults
No built items -> the Draft button stays disabled with the hint "List at least one thing that works now."
A stored rehearsal also refills the list with its built items, so a redraft starts from what was sent. The list
always keeps one row (its Remove is disabled); "Add an item" stops at 8.
