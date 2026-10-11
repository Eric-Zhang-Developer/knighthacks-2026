## What shipped
An observatory theme over the galaxy: near-black sky, brass instrument markings, the idea cyan as the one accent;
Cormorant Garamond headings, IBM Plex Sans text, Plex Mono data. Six type sizes, a 4px space scale, panel/field/round
radii, shared `ui-button`/`ui-field`/`ui-chip`/`ui-mark` classes, thin dark scrollbars. The map's layout toggle, zoom
stack and tooltip are glass over the sky. The legend no longer scrolls sideways or clips "Categories" and its counts.

## Where it lives
`app/globals.css`, `app/layout.tsx`, `app/fonts/`, the owned `components/*/*.module.css`, `tests/ui-redesign/`,
`tests/e2e/ui-redesign/`.

## How to check it
verify: `node scripts/verify.mjs ui-redesign /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/ui-redesign/20261011T035821Z` pass at 0f066df (evidence: desktop and phone screenshots there)

## Gaps
Layout (bottom-centre entry, contextual side panel, filters, header) is live-mentor-ui's (#369) and untouched, so the
header filters still truncate. On a phone the rail gives the project list ~5px (page.module.css, reported on #369).
Not yet reviewed by the person (Validation 4). e2e that fail here also fail on main a1526ef: branches-ui:9,
design-refresh:114 (and :63 intermittently).
