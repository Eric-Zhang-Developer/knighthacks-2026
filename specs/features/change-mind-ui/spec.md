---
name: Ask 'what would change your mind?' and see each assumption with its reversal test
depends_on: [change-mind-api, prove-it-ui]
owns: [components/challenge/, tests/change-mind-ui/, tests/e2e/change-mind-ui/]
assignee: ""
---

# What would change your mind? (F23): UI

Frontend half: Mac workers only (user decision 2026-10-10). The challenge panel is done, so this feature owns `components/challenge/` and renders inside it: no shell change. Build on the shape pinned in `change-mind-api`.

## Plan
1. In the challenge panel: "What would change your mind?" lists each assumption by kind with its `ClaimBadge` and its reversal condition, or "evidence is insufficient".
2. An assumption with a reversal offers "Prove it in ten minutes" only when a challenge round has an outcome of `test` for it; otherwise it shows the condition alone.

## Requirements
- Insufficient evidence reads as such, never as a pass.
- The challenge and prove-it e2e suites still pass unchanged.

## Validation
1. Save an idea -> assumptions appear, each with a kind, a label and a reversal or "evidence is insufficient".
2. `tests/e2e/change-mind-ui/` covers 1, and `tests/e2e/challenge-ui/` and `tests/e2e/prove-it-ui/` still pass. Keep a screenshot.

## Defaults
Grouped by kind: need, data, feasibility, differentiation.
