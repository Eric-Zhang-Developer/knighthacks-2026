---
name: Material 3 tokens with Apple materials and motion, over a full-bleed map
depends_on: [visual-polish, experience-shell, galaxy-2d]
owns: [app/globals.css, app/layout.tsx, app/page.tsx, app/page.module.css, components/shell/, components/ui/, tests/design-refresh/, tests/e2e/design-refresh/, tests/e2e/experience-shell/]
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
2. Layout: the map fills the window. Desktop: a translucent top app bar; the discovery rail and contextual rail are
   floating Material surfaces (corner `large`, 12px from the edges) with an Apple material behind them (backdrop
   blur and saturate); the composer is a floating pill at the bottom centre. Same widths and order as the shell.
3. Phone: a Material 3 navigation bar (icons with labels, active indicator pill, 80px plus the safe area) for
   Explore / Talk / Idea / Decide. The open project is a bottom sheet with a drag handle: it tracks the finger
   1:1, and on release goes up or down by velocity (apple-design §5–6, damping 0.8, response 0.3).
4. Components: buttons, chips, selects and text fields restyled as Material filled, tonal, outlined and text
   variants through `components/ui/` classes and global element styles. Full-pill buttons, a 48px minimum target
   on the phone, and hover, focus and pressed state layers. A button press scales 0.97 on pointer-down.
5. Type: Material roles (display for the wordmark, title for panel headings, body, label) with size-specific
   tracking (negative on display, positive on labels).

## Requirements
- WCAG AA: 4.5:1 for text and 3:1 for UI boundaries, on the translucent surfaces at their least opaque.
- `prefers-reduced-transparency`: solid surfaces, no blur. `prefers-contrast: more`: solid surfaces with `outline`
  borders. `prefers-reduced-motion`: cross-fades only, no springs.
- No gradient borders, no purple-on-white, no glow on text, no continuous decorative motion.
- Each panel's own e2e suite passes unchanged; visual-polish's token check (panels share `--panel`, `--border`,
  `--heading`) still holds.

## Validation
1. The map's canvas covers the whole window at 1440x900 and 390x844; the rails, top bar and composer sit over it,
   at experience-shell's sizes (52 / 224 / 360 / 72 ±1). This supersedes experience-shell's "galaxy filling the
   remaining centre"; its e2e is updated here.
2. Computed styles: panels use `--md-sys-color-surface-container*` backgrounds and `--md-sys-shape-corner-large`;
   buttons use `corner-full`; every text/background pair checked in the e2e is ≥ 4.5:1.
3. With reduced transparency emulated, no element has a `backdrop-filter`; with reduced motion, the sheet opens
   with no transform transition.
4. Phone: drag the project sheet's handle down 120px quickly and release: it closes; drag 40px slowly and release:
   it springs back open.
5. `tests/e2e/design-refresh/` covers 1–4 with desktop and phone screenshots, and the visual-polish,
   experience-shell, galaxy-2d, voice, idea-create-ui and project-drawer suites still pass.

## Defaults
Hand-written CSS custom properties with Material token names (no `@material/web`, which is maintenance-only and
needs client-side custom elements); one small spring helper in `components/shell/`, no new dependency.
