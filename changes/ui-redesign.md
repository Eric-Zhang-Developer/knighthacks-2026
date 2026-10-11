## What shipped
An observatory theme over the galaxy: near-black sky, brass instrument markings, the idea cyan as the one accent;
Cormorant Garamond headings, IBM Plex Sans text, Plex Mono data. Six type sizes, a 4px space scale, panel/field/round
radii, shared `ui-button`/`ui-field`/`ui-chip`/`ui-mark` classes, thin dark scrollbars. The map's layout toggle, zoom
stack and tooltip are glass over the sky. The legend no longer scrolls sideways or clips "Categories" and its counts.

## Where it lives
`app/globals.css`, `app/layout.tsx`, `app/fonts/`, the owned `components/*/*.module.css`, `tests/ui-redesign/`,
`tests/e2e/ui-redesign/`.

## How to check it
`node scripts/verify.mjs ui-redesign <evidence>` pass at 0f066df (desktop 1440x900 and phone 390x844 screenshots in the evidence folder).

## Gaps
Layout (bottom-centre entry, contextual side panel, filters, header) is live-mentor-ui's (#369) and untouched, so the
header filters still truncate. On a phone the rail gives the project list ~5px (page.module.css, reported on #369).
Not yet reviewed by the person (Validation 4). e2e that fail here also fail on main a1526ef: branches-ui:9,
design-refresh:114 (and :63 intermittently).
