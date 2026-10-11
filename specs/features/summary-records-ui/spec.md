---
name: Label summary-only projects in the drawer, search results and evidence cards
depends_on: [summary-records-api]
owns: [components/drawer/index.tsx, components/search/index.tsx, components/evidence/index.tsx, tests/summary-records-ui/, tests/e2e/summary-records-ui/]
assignee: ""
---

# Summary-only records: UI

Mac (frontend). Wherever a summary-only project is shown or quoted, say so plainly, so a gallery tagline is never
mistaken for a write-up (the roadmap's corpus goal, #317: "a 'summary only' label wherever a record is shown or
quoted").

## Plan
1. Drawer: when `description` is empty, replace "description unknown" with "Gallery card only: Devpost lists a
   title and tagline; no description on record", next to the existing link to the Devpost page.
2. Search results: a hit with `summaryOnly: true` shows a short "card only" tag after its title.
3. Evidence card: when `excerptSource` isn't `"description"`, the excerpt's heading reads "From the gallery card
   (title and tagline only)" instead of presenting it as the source excerpt.

## Requirements
- Reuse existing classes and components. ui-redesign owns the `.module.css` files: no CSS edits here.
- The labels are text, not colour alone, and are read by screen readers.
- Full records look exactly as they do today.

## Validation
1. With summary-records-api on a test database holding one summary-only and one full project:
   open the summary-only project -> the drawer shows the gallery-card line and the Devpost link; search for it ->
   its row shows "card only" and the full project's row doesn't; generate evidence with it as a neighbour -> the
   excerpt heading reads "From the gallery card". Keep a screenshot of each.
2. Component tests for each label, on and off. `tests/e2e/summary-records-ui/` covers step 1 on desktop and phone.
   Run the tech-stack Checks and `verify.py --slug summary-records-ui --worktree .`.
