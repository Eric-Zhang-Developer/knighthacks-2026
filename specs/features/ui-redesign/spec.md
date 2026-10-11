---
name: An observatory theme over the galaxy, one set of controls, and no broken chrome
depends_on: [design-refresh, galaxy-3d]
owns: [app/globals.css, app/layout.tsx, app/fonts/, components/ui/, components/classes/classes.module.css, components/history/history.module.css, components/explainer/explainer.module.css, components/drawer/drawer.module.css, components/galaxy/galaxy.module.css, components/idea/idea.module.css, components/evidence/evidence.module.css, components/interview/interview.module.css, components/revisions/revisions.module.css, components/branches/branches.module.css, components/challenge/challenge.module.css, components/scorecard/scorecard.module.css, components/plan/plan.module.css, components/snapshot/snapshot.module.css, components/share/share.module.css, components/share/shared.module.css, components/votes/votes.module.css, components/rehearsal/rehearsal.module.css, components/voice/voice.module.css, tests/ui-redesign/, tests/e2e/ui-redesign/]
assignee: "eric-claude-agent-1"
---

# UI redesign: an observatory over the galaxy

Frontend: Mac. Owner eric-claude-agent-1, with the person's permission to merge (2026-10-10, in session).

## Why

The person, looking at production after galaxy-3d: the galaxy looks great and everything around it looks generic and
vibe-coded, with no theme. Measured on main at a7d7734:

- **No identity.** design-refresh put the chrome on Material 3 defaults: Roboto Flex for every role and the stock
  `#adc6ff` primary. Nothing in the chrome relates to the star chart it frames.
- **Broken chrome.** The legend panel shows a white scrollbar and a horizontal one, clips "CATEGORIES" to "CATEGO" and
  cuts off counts; "What am I looking at?" wraps at ~28px into a clipped line under the dev badge; the header filters
  truncate ("All eve…", "All cate…", "Any pr…").
- **No system underneath.** Across 28 stylesheets: 12 distinct font sizes (10–40px, most hard-coded), 10 distinct
  corner radii, 139 hard-coded pixel spacings beside 250 token ones, and no shared button: every panel styles its
  own, so pills, outlined rectangles and text links sit side by side. Cards nest inside bordered panels.

This supersedes design-refresh's Material 3 system (a person decision earlier the same day) for colour, type, shape
and controls. Its accessibility floors stay: WCAG AA contrast, 44px targets, reduced motion and reduced transparency.

## Scope (and what it leaves alone)

Layout belongs to live-mentor-ui (#369, in flight): the bottom-centre conversation entry, the contextual side panel,
the Filters disclosure and removing the totals strip and explainer from the first view. This feature does not touch
`app/page.tsx`, `app/page.module.css`, `components/shell/`, `components/idea/index.tsx`, `components/voice/index.tsx`,
`components/search/` or `components/workspace/`. It supplies the system those surfaces use: the tokens in
`app/globals.css` and the primitives in `components/ui/`, so #369 picks the theme up by consuming them.

## The system

Revised 2026-10-11. The person, looking at production: "the elements are boring. It's just the slate colors… It's not
themed properly. It looks like AI slop… What if we did completely pitch black? I want to go with a proper observatory
theme", pointing at getartemisai.com for the controls; then chose square corners and a red accent ("go red").

Revised again the same day, before judging: the person preferred the live-mentor shell's design (#369, the voice
bubble in the middle) and asked for it "implemented and deployed to the whole app", replacing the red square theme.

- **Direction: the live-mentor shell's steel blue, everywhere.** Black sky; navy glass panels (`--panel` #0c1018 with a
  hairline, glass `--material-thick` where a surface floats over the map). No card inside a bordered panel.
- **Type.** IBM Plex Sans for reading and headings (`--font-display` points at it), Plex Mono for data (counts, years,
  step markings). Sentence-case controls. Self-hosted in `app/fonts/` (#226). Six sizes only, as tokens.
- **Colour.** Neutral steel text in three steps, brass for markings, one accent: pale blue `#a4cbff` (`--accent`,
  `--idea`), the voice bubble's light. Buttons are deep steel `--control` #202d42 with a `#657894` edge; pressed or
  current is `--control-on` #30435f. The idea star on the canvas keeps its cyan. Failure red and warning amber for
  states only.
- **Shape and space.** Pills for buttons, 12px fields, 20px panels; true circles stay round. A 4px spacing scale;
  owned stylesheets use spacing and type tokens, not raw values. On a phone the layout toggle sits top right, clear of
  the shell's "Browse the map".
- **Controls.** One `Button` (primary, quiet, icon), one `Field` (input, select, textarea), one `Chip` (toggles and
  filters), exported from `components/ui` and as global classes (`ui-button`, `ui-field`, `ui-chip`) for panels whose
  markup belongs to other features. Panels adopt them through their stylesheets.

## Validation

1. `tests/ui-redesign/` checks the owned stylesheets: every font size and radius is a token from the scale above, and
   spacing in owned files uses tokens.
2. `tests/e2e/ui-redesign/` at 1440x900 and 390x844 on the home page: no visible text is clipped (no element with
   `scrollWidth > clientWidth` among legend, rail and panel text), no visible scrollbar inside the legend, and
   screenshots at both widths.
3. Every existing e2e suite that passed on main before still passes; none is weakened.
4. The person reviews the screenshots. Contrast of text tokens against the panel fill clears 4.5:1 (checked in 1).

## Plan

1. Tokens and fonts (`app/globals.css`, `app/layout.tsx`, `app/fonts/`), keeping the existing token names working as
   aliases so no panel breaks mid-way.
2. Primitives in `components/ui/` and the global classes.
3. A pass over each owned panel stylesheet: adopt the controls, the type and spacing scales, the two radii; fix the
   legend, history and explainer breakage.
4. Tell live-mentor-ui's owner which tokens and classes to use for #369's surfaces.
