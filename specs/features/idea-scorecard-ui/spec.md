---
name: See an idea's scorecard in its evaluation
depends_on: [idea-scorecard-api]
owns: [components/scorecard/, tests/idea-scorecard-ui/, tests/e2e/idea-scorecard-ui/]
assignee: ""
---

# Idea scorecard: UI (#269)

Frontend: Mac workers.

## Plan
1. On the active version: "Score this idea" → five rows showing the criterion, the score out of 5 (as text and a
   meter), and expandable for and against points with badges. Cited projects open the drawer.

## Requirements
- `PanelState` for loading, failed and empty. A null score shows "evidence is insufficient".
- No total and no win odds anywhere.

## Validation
1. Stubbed route → five rows render. A cited project opens the drawer.
2. `tests/e2e/idea-scorecard-ui/` covers 1. Keep a screenshot.

## Defaults
Mount through the shell (#269).
