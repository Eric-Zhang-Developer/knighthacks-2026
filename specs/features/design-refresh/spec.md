---
name: Material 3 tokens with Apple materials and motion, over a full-bleed map
depends_on: [visual-polish, experience-shell, galaxy-2d]
owns: [app/globals.css, app/layout.tsx, app/fonts/, app/page.tsx, app/page.module.css, components/shell/, components/ui/, tests/design-refresh/, tests/e2e/design-refresh/, tests/e2e/experience-shell/]
assignee: "eric-frontend-agent"
---

# Design refresh

Frontend only: Mac workers (user decision 2026-10-10, owner eric-frontend-agent). The person wants the app to look
designed, not generated, and asked for Apple's design approach and Google's Material Design together. The two split
cleanly: **Material 3 is the system** (colour roles, tonal surfaces, the shape scale, the type scale, the navigation
bar and state layers) and **Apple supplies the materials and motion** (translucent chrome over content, sheets with
springs, reduced-motion and reduced-transparency fallbacks). The map is the content, so it goes edge to edge like a
maps app, and the panels float over it.

Visual target: `docs/design-references/desktop.png` and `phone.png` (the person's references, read with their
README): luminous category clusters with labelled counts, a glowing idea anchor, glass panels, chip filters, an icon
navigation bar. Mockup numbers and names are illustrative and are never shown as data.

## Plan
1. Tokens: a dark Material 3 scheme (`--md-sys-color-*`) from one seed colour, the shape scale
   (`--md-sys-shape-corner-*`) and the type scale (`--md-sys-typescale-*`, Roboto Flex via next/font). The legacy
   tokens every panel uses (`--panel`, `--border`, `--text`, `--muted`, `--heading`, ...) are redefined as Material
   roles, so all panels change without touching their files.
2. Layout: the chart fills the window. Desktop: a translucent top app bar; the discovery rail and contextual rail
   are floating Material surfaces (corner `large`, 12px from the edges) with an Apple material behind them
   (backdrop blur and saturate); the composer is a floating pill at the bottom centre. Same widths and order as the
   shell. The canvas sits between the rails, not under them: the galaxy suite aims at the cloud's centre as the
   canvas's centre, so a canvas hidden behind the rails would put the map's middle off-centre. The contextual rail
   grows with its content instead of filling the height.
   The reference's single text-and-voice composer is not adopted: the textbox stays in the Idea card
   (`specs/decisions/experience-shell-composer.md`), and the pill carries push-to-talk only.
3. Phone: a Material 3 navigation bar (icons with labels, active indicator pill, 80px plus the safe area) for
   Explore / Talk / Idea / Decide / Plan. The open project is a sheet with a drag handle: it tracks the finger 1:1,
   and on release a flick's projected end decides close or stay, with a spring carrying the release velocity
   (apple-design §5–6, damping 0.8, response 0.3). It hangs from the top and leaves upward (apple-design §7: out
   the way it came), because visual-polish's phone check needs search, the explainer and push-to-talk, below it,
   reachable with a project open.
4. Components: buttons, chips, selects and text fields restyled as Material filled, tonal, outlined and text
   variants through `components/ui/` classes and global element styles. Full-pill buttons, a 48px minimum target
   on the phone, and hover, focus and pressed state layers. A button press scales 0.97 on pointer-down.
5. Type: Material roles (display for the wordmark, title for panel headings, body, label) with size-specific
   tracking (negative on display, positive on labels).
6. A calmer brainstorming flow (the person, 2026-10-10: "not frustrated with the amount of stuff… as simple as it
   can be… about brainstorming… positive"; research in `research.md`):
   - The idea path in brainstorming order, judging last: Idea, then Explore (what exists nearby), Grow (revise,
     branch, compare versions), Test (scorecard, challenge), Decide, Plan (IDEO's defer judgment).
   - A sticky step index at the top of the contextual rail once an idea exists, as Material filter chips: where
     you are and where you can go; it jumps to a step's panels instead of hiding the others, so every panel stays
     where its own feature's suite expects it. Panels are labelled "Step n".
   - An empty start is one prompt and four example sparks (suggestion chips) that fill the draft in one tap and
     disappear once there's a draft or an idea. They're examples to edit, never data.
   - Copy the shell owns is encouraging ("Need a spark? Start from one of these and make it yours.").
   - A failed or partial panel state is a hiccup, not an alarm: a tonal container, the words in on-surface, the
     glyph alone in the error (or uncertain) colour, Retry as a tonal pill. The shared `PanelState` does this for
     every panel; each panel's message text stays its own feature's.

## Requirements
- WCAG AA: 4.5:1 for text and 3:1 for UI boundaries, on the translucent surfaces at their least opaque.
- `prefers-reduced-transparency`: solid surfaces, no blur. `prefers-contrast: more`: solid surfaces with `outline`
  borders. `prefers-reduced-motion`: cross-fades only, no springs.
- No gradient borders, no purple-on-white, no glow on text, no continuous decorative motion.
- Each panel's own e2e suite passes unchanged; visual-polish's token check (panels share `--panel`, `--border`,
  `--heading`) still holds. Its phone check opens search, a project, the explainer and voice together, so on the
  phone the project sheet's resting detent must leave the explainer and the push-to-talk bar uncovered.

## Validation
1. At 1440x900 the chart background covers the window; the rails float 12px in from the edges at experience-shell's
   sizes (52 / 224 / 360 / 72 ±1), the canvas fills the space between them below the top bar, and the composer
   floats over its bottom. This supersedes experience-shell's "galaxy filling the remaining centre"; its e2e is
   updated here.
2. Computed styles: panels use `--md-sys-color-surface-container*` backgrounds and `--md-sys-shape-corner-large`;
   buttons use `corner-full`; every text/background pair checked in the e2e is ≥ 4.5:1.
3. With reduced transparency emulated, no element has a `backdrop-filter`; with reduced motion, the sheet opens
   with no transform transition.
4. Phone: drag the project sheet's handle up 120px quickly and release: it closes; drag 40px slowly and release:
   it springs back open.
5. An empty start shows four sparks; tapping one fills the idea textbox and the sparks go. After saving an idea
   the step index lists the steps that have panels; choosing "Test" scrolls the rail to the scorecard and marks
   Test current.
6. A panel whose request fails shows its message in on-surface text (contrast ≥ 4.5 on its container) with the
   glyph in the error colour, and a Retry pill.
7. No element paints a ring pattern (`repeating-radial-gradient`) behind the galaxy: the galaxy turns in 3D
   (galaxy-3d), and a flat pattern wouldn't turn with it.
8. `tests/e2e/design-refresh/` covers 1–7 with desktop and phone screenshots, and the visual-polish,
   experience-shell, galaxy-2d, voice, idea-create-ui and project-drawer suites still pass.

## Defaults
Hand-written CSS custom properties with Material token names (no `@material/web`, which is maintenance-only and
needs client-side custom elements); one small spring helper in `components/shell/`; navigation icons as inline SVG
(Material Symbols outlines, Apache-2.0), no new dependency.
