---
name: A small board of when projects were started, next to the AI coding tools of the time
depends_on: [corpus-classify, galaxy-explainer]
owns: [components/era/, components/explainer/, tests/era-board-ui/, tests/e2e/era-board-ui/]
assignee: ""
---

# AI tools and eras (#269)

Frontend: Mac workers. A simple board, as the user asked: was a project started before or after AI coding tools
became common?

## Plan
1. Inside "What am I looking at?": a table with groups "Started through 2022", "2023–2024", "2025 onward" and "Start
   date unknown". Each row shows its project count and its `dev_tools` counts (reported, reported non-use,
   unknown) from `classes.json`.
2. Under the table, a dated line of tool releases as context: Copilot technical preview (2021), ChatGPT (Nov 2022),
   Claude Code (2025). Each links to its source.

## Requirements
- Groups are labelled by start date only. The board never says a project was or wasn't built with AI unless
  `dev_tools` is `reported` or `reported_non_use`.
- Counts are computed from `stars.json` and `classes.json`, never typed in.
- The date is Devpost's "started this project" time. Say so in one line.

## Validation
1. Open the explainer → the four rows' counts sum to the corpus count, and the tool-use counts sum to each row's
   count.
2. `tests/e2e/era-board-ui/` covers 1. Keep a screenshot.

## Defaults
Release dates are checked against their sources before merge. Cut this first if time runs short.
