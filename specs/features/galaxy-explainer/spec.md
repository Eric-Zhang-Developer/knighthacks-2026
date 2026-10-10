---
name: Explain what the galaxy shows and what it doesn't
depends_on: [galaxy]
owns: [components/explainer/, tests/galaxy-explainer/, tests/e2e/galaxy-explainer/]
assignee: ""
---

# Explain the galaxy (F20)

## Plan
1. A "What am I looking at?" panel: projects indexed (from `stars.json`), source coverage (events), that
   nearness means similar descriptions, and that empty space does not mean an idea is original.

## Requirements
- Counts come from `stars.json`, never typed in.
- States plainly: the 3D layout is a projection; similarity is computed in embedding space.

## Validation
1. Open the panel -> the count equals `stars.json`'s `count`. `tests/e2e/galaxy-explainer/` checks it.

## Defaults
Short: under 120 words.
