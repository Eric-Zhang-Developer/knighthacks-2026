---
name: Reveal the galaxy's projects over time without moving any star
depends_on: [galaxy, corpus-embed]
owns: [components/galaxy/, components/history/, tests/galaxy-history/, tests/e2e/galaxy-history/]
assignee: ""
---

# Historical reveal (F02)

Frontend: Mac workers only (user decision 2026-10-10). galaxy is done, so this feature owns `components/galaxy/`
and renders its controls inside the galaxy: no shell or store change, no helper PRs.

## Plan
1. `components/history/`: play, pause, scrub and speed controls over the years present in `stars.json`, rendered
   by the galaxy component, with the reveal year kept in local state.
2. The galaxy hides stars whose `year` is later than the reveal year. Hidden, not moved: the same buffer, the same
   coordinates.
3. Galaxy tooltips and the project list label the year as "created <year>", not beside the event name as if it
   were the event date.

## Requirements
- No star's coordinates change at any point of the reveal.
- `year` in `stars.json` is the project's created year, not its event date (corpus-embed Gaps); the controls and
  every year label say "created", so the reveal isn't read as event history.
- Projects with no year are counted and labelled "date unknown"; they stay visible and are never assigned a year.
- `prefers-reduced-motion` turns play into stepping.

## Validation
1. Scrub to the earliest year -> only that year's stars (plus "date unknown") show; the visible count matches
   `stars.json`.
2. At every scrub step, the e2e reads the star positions and fails if any differs from `stars.json`.
3. Hover a star and open the list -> its year reads "created <year>", never "<event> · <year>".
4. Play to the end -> every star is visible again. `tests/e2e/galaxy-history/` covers 1–4, and galaxy's own e2e
   still passes. Keep a screenshot of a mid-reveal frame.

## Defaults
No reveal year means show everything. Speed: one year per second.
