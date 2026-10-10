---
name: Colour the galaxy by domain, ring prize winners, and filter by both
depends_on: [corpus-classify, galaxy, search-filters-ui]
owns: [components/classes/, lib/classes/, components/galaxy/Scene.tsx, components/galaxy/stars.ts, components/search/, components/drawer/, tests/galaxy-classes-ui/, tests/e2e/galaxy-classes-ui/]
assignee: ""
---

# Category galaxy (#269)

Frontend: Mac workers. The user's first screen: stars grouped by colour, each colour a category, with winners
marked. It reads `public/classify/classes.json` (corpus-classify). Build and test against a fixture under
`tests/galaxy-classes-ui/` until that file lands.

## Plan
1. `lib/classes/`: load and validate `classes.json`. When it's missing or its `corpus_version` doesn't match
   `stars.json`, the galaxy renders as before and the legend says "categories not loaded".
2. Star colour = domain (one muted palette entry per domain; `mixed` and `insufficient_text` in neutral grey).
   Highlighted, selected and idea stars keep their current styles on top.
3. Prize ring: stars with a `placement` or `sponsor` prize get a ring (a shape, so not colour alone). `participation`
   and `other` don't.
4. `components/classes/` legend: each domain with its count, `mixed` and "Not enough text" with theirs, and a "Prize
   winners" toggle. Clicking an entry filters the stars and the list. A Reset clears it.
5. Search filters gain Category and Prize (any placement, 1st/2nd/3rd, sponsor) beside event and year. Search
   ranking itself never uses the category.
6. Drawer and list: the domain (labelled `inferred`), each prize with its event, the kind and place, and the
   sponsor.

## Requirements
- Counts come from the loaded file, never typed in. Map, list and legend counts agree under any combination of
  filters.
- A prize ring shows the event it came from. With an event filter on, only prizes from that event count.
- Legend entries and filters are keyboard-reachable buttons or native selects with labels. Colour is always paired
  with a label or shape.
- The galaxy, search, search-filters-ui and project-drawer e2e suites still pass.

## Validation
1. Open `/` → stars show several colours, and the legend lists domains with counts that sum to the corpus count.
2. Click a domain → only its stars and list items remain, and the count matches. Reset → all return.
3. Turn on "Prize winners" → only ringed stars remain. Open one → the drawer shows its prize text, event, kind and
   place.
4. `tests/e2e/galaxy-classes-ui/` covers 1–3 with a fixture. Keep desktop and phone screenshots.

## Defaults
Palette: 14 distinguishable muted hues on the dark map, checked for contrast against the background. Mount the
legend in the map area through the shell (#269).
