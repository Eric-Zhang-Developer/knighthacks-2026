---
name: A Plan step after the user decides on an idea
depends_on: [build-plan-api]
owns: [components/plan/, tests/build-plan-ui/, tests/e2e/build-plan-ui/]
assignee: ""
---

# Build plan: UI (#269)

Frontend: Mac workers. It's the last step of the flow: Explore → Talk → Idea → Decide → **Plan**.

## Plan
1. A "Plan this idea" action on the active version: hours left and team size (prefilled 10 and 2) → generate. It
   shows the tour, cut list, timeline and risks, each with its `ClaimBadge`.
2. Regenerate creates a new plan, and the previous one stays readable.

## Requirements
- `PanelState` covers loading, empty, failed and retry.
- Keyboard reachable. Badges carry text.

## Validation
1. With an active idea, generate → the four sections render with badges. A failure from the stubbed route shows
   failed plus retry.
2. `tests/e2e/build-plan-ui/` covers 1. Keep a screenshot.

## Defaults
Mount through the shell (#269).
