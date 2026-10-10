---
name: Reveal the galaxy's projects over time without moving any star
depends_on: [galaxy, corpus-embed]
owns: [components/history/, tests/galaxy-history/, tests/e2e/galaxy-history/]
assignee: ""
---

# Historical reveal (F02)

Backlog. It touches the shared shell and the galaxy, so it takes two small helper PRs before its own.

## Plan
1. `fix: add revealUntilYear to the shared store and mount history controls`: a `revealUntilYear: number | null`
   field in `lib/store.ts`, and `<History />` from `components/history/index.tsx` in the map region of
   `app/page.tsx`.
2. `fix(galaxy): hide stars after revealUntilYear`: the galaxy hides stars whose `year` is later. Hidden, not
   moved: the same buffer, the same coordinates.
3. History controls: play, pause, scrub and speed over the years present in `stars.json`.

## Requirements
- No star's coordinates change at any point of the reveal.
- Projects with no year are counted and labelled "date unknown"; they stay visible and are never assigned a year.
- `prefers-reduced-motion` turns play into stepping.

## Validation
1. Scrub to the earliest year -> only that year's stars (plus "date unknown") show; the count matches.
2. Play to the end -> every star is back, at its original position.
3. `tests/e2e/galaxy-history/` covers 1–2. Keep a screenshot of a mid-reveal frame.

## Defaults
`null` means show everything. Speed: one year per second.
