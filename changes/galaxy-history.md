## What shipped
Reveal-by-year controls in the galaxy (Play/Pause, a created-year slider, speed at 0.5, 1 or 2 years per second, and All). Stars created after the reveal year are hidden in the same buffer (size 0, not pickable, never moved). Stars with no year stay visible and are counted as "date unknown". Under `prefers-reduced-motion`, Play becomes Step. Galaxy tooltips and the project list now show "created <year>" on its own line instead of "<event> · <year>". The reveal controls and project list stack at the top left.
## Where it lives
`components/history/`, `components/galaxy/` (index.tsx, Scene.tsx, stars.ts, galaxy.module.css), `tests/galaxy-history/`, `tests/e2e/galaxy-history/`
## How to check it
verify: `node scripts/verify.mjs galaxy-history /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/galaxy-history/20261010T121504Z` pass at 1be421a (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/galaxy-history/20261010T121504Z)
The galaxy, project-drawer, galaxy-explainer, visual-polish, bootstrap, search and voice e2e suites pass unchanged (42 runs, each test twice). The position check was confirmed to fail when hidden stars are moved.
## Gaps
- The shipped corpus has one year (all 100 records are 2026), so the reveal has a single step until the full corpus lands. The e2e uses a synthetic multi-year fixture.
- Search results still show "<event> · <year> · <score>". They're outside this feature's owns, so search's owner should switch to "created <year>".
