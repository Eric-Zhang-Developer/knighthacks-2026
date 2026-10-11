---
name: Label summary-only projects in the drawer and in evidence excerpts
depends_on: [summary-records-api]
owns: [components/drawer/index.tsx, components/evidence/index.tsx, tests/summary-records-ui/, tests/e2e/summary-records-ui/]
assignee: ""
---

# Summary-only records: UI

Mac (frontend). Where a summary-only project's text is shown or quoted, say so plainly, so a gallery tagline is
never mistaken for a write-up (the roadmap's corpus goal, #317). Those places are the drawer (the only view of a
project's own text) and the evidence excerpt (the only view that quotes it). The alternative, combinations,
challenge, galaxy hover, snapshot and share views show a project's title and link, never its text, so they need no
label. Search rows are left out: draft #369 (live-mentor-ui) is editing `components/search/index.tsx`.

## Plan
1. Drawer: when `description` is empty, replace "description unknown" with "Gallery card only: Devpost lists a
   title and tagline; no description on record", next to the existing link to the Devpost page.
2. Evidence card: when `excerptSource` is `"tagline"` or `"title"`, the excerpt's heading reads "From the gallery
   card (title and tagline only)" instead of presenting it as the source excerpt; `"unknown"` reads "Source text
   has changed since this card was made".

## Requirements
- Reuse existing classes and components. ui-redesign owns the `.module.css` files: no CSS edits here.
- The labels are text, not colour alone, and are read by screen readers.
- Full records look exactly as they do today.

## Validation
1. With summary-records-api on a test database holding one summary-only and one full project:
   open the summary-only project -> the drawer shows the gallery-card line and the Devpost link, and the full
   project's drawer doesn't; generate evidence with it as a neighbour -> the excerpt heading reads "From the gallery
   card". Keep a screenshot of each.
2. Component tests for each label, on and off. `tests/e2e/summary-records-ui/` covers step 1 on desktop and phone.
   Run the tech-stack Checks and `verify.py --slug summary-records-ui --worktree .`.
