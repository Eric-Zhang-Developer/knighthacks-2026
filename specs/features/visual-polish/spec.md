---
name: Shared panel states, claim badges and one visual pass over the finished panels
depends_on: [search, project-drawer, galaxy-explainer, voice]
owns: [app/globals.css, app/page.module.css, components/ui/, components/search/, components/drawer/, components/explainer/, components/voice/, tests/visual-polish/, tests/e2e/visual-polish/]
assignee: ""
---

# Visual polish (Design criterion)

Frontend: Mac workers only (user decision 2026-10-10). Design is one of the five rubric criteria
(`specs/context/event.md`), and the V3 plan's "Visual and interaction direction" asks that loading, empty,
partial, failed and offline states get the same care as success. Ten `-ui` features are about to start; without
shared pieces each builds its own. The colour tokens already exist in `app/globals.css`.

## Plan
1. `components/ui/`: `<PanelState kind="loading" | "empty" | "partial" | "failed" | "offline">` with a short
   message and an optional retry, and `<ClaimBadge label="supported" | "inferred" | "unverified">` (text and a
   distinct shape for each label, never colour alone). Export both from `components/ui/index.ts`.
2. Panel base styles in `app/globals.css`: a solid readable panel over the canvas, one heading scale, one spacing
   scale, focus rings.
3. Apply them to the finished panels: search, drawer, explainer and voice. Behaviour stays the same.
4. One look for the whole page, after user feedback on 2026-10-10 that the frontend "looks like ass" (it was
   system fonts, flat grey boxes, a galaxy that filled a third of its area): a star chart. Ink, paper and brass
   tokens; engraved serif headings (Cormorant Garamond), IBM Plex Sans for reading, IBM Plex Mono for the chart's
   annotations, loaded with `next/font`. The side column numbers each panel that appears as a step (01, 02, …),
   so the demo path reads in order. Voice floats as a pill over the map. The map shows a faint graticule and glow
   behind a transparent galaxy canvas. Panels stay solid, and behaviour stays the same.

## Requirements
- Text on panels meets WCAG AA contrast (4.5:1) against the panel colour; the unit test computes it from the
  tokens.
- Every claim badge carries its label as text.
- No continuous motion; `prefers-reduced-motion` removes the transitions this adds.
- The finished panels' own e2e tests still pass unchanged.

## Validation
1. `pnpm test` -> `tests/visual-polish/` checks the token contrast pairs, and renders each `ClaimBadge` label and
   each `PanelState` kind with `react-dom/server`, asserting its text (no new dependency, no test page).
2. Open `/`, run a search, open a star -> the e2e reads `getComputedStyle` on the search, drawer, explainer and
   voice panels and fails unless background, border and heading size all equal the panel tokens. Screenshots at
   desktop and phone widths are kept as evidence, not as the check.
3. `tests/e2e/visual-polish/` covers 2, and the search, project-drawer, galaxy-explainer and voice e2e suites
   still pass.

## Defaults
The chart palette in `app/globals.css` replaces the first tokens (Plan 4); add new ones only for states. No new
dependency: fonts come through `next/font`, which ships with Next.
