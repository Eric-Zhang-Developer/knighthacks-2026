---
name: See related GitHub and Hugging Face work, labelled product versus building block
depends_on: [research-api, problem-evidence-ui]
owns: [components/idea/, tests/research-ui/, tests/e2e/research-ui/]
assignee: ""
---

# GitHub and Hugging Face research (F13, F14): UI

Frontend half: Mac workers only (user decision 2026-10-10). The idea card is done (idea-create-ui, then
problem-evidence-ui), so this feature owns `components/idea/` and renders inside it, below "Is this problem real?":
no shell change. Build on the shape pinned in `research-api`. (Planned for the evidence panel, but combinations-ui
holds that folder; the idea card is free and already holds the idea's other outside evidence.)

## Plan
1. "What already exists?" runs the research for `activeIdeaVersionId`, then groups items under four headings:
   direct alternatives, adjacent work, research, building blocks. Each item shows its name linked to `url`, its
   source (GitHub, Hugging Face model, Space or dataset), its description, its popularity with the metric named
   ("1,204 stars"), and its `reason` with a `ClaimBadge`.
2. Sources listed in `unavailable` show as "GitHub didn't answer (403); try again later", never as "nothing found".

## Requirements
- A building block never appears under direct alternatives (V3 F14); the heading text says what each group means.
- "Searched on <searchedAt>" is always shown. Links open in a new tab with `rel="noopener noreferrer"`.
- Loading and failure use `PanelState`. The idea card's and problem evidence's e2e suites still pass unchanged.

## Validation
1. Fixture research (stubbed route) with one item per kind and GitHub in `unavailable` -> four groups, each item
   with its link, source, popularity metric and labelled reason; the unavailable note names GitHub.
2. A fixture `hf-model` item -> it shows under building blocks.
3. `tests/e2e/research-ui/` covers 1–2, and `tests/e2e/idea-create-ui/` and `tests/e2e/problem-evidence-ui/` still
   pass. Keep a screenshot.

## Defaults
Collapsed to the first two items per group; expand for the rest.
