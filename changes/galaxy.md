## What shipped
A 3D galaxy of `public/corpus/stars.json`: all stars in one shader points buffer (colour paired with size for selected, highlighted and idea stars), orbit/zoom/pan, hover title, click to set `selectedProjectId`, and a keyboard list ("Projects (N)") that sets the same selection. The camera locks while a project is selected; clicking empty space clears it. No `stars.json` still shows "Corpus not loaded".
## Where it lives
`components/galaxy/` (index.tsx, Scene.tsx, stars.ts, galaxy.module.css), `tests/galaxy/` (unit tests, synthetic fixture), `tests/e2e/galaxy/`
## How to check it
verify: `node scripts/verify.mjs galaxy /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/galaxy/20261010T104258Z` pass at 5f56e31 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/galaxy/20261010T104258Z)
## Gaps
- Real corpus not rendered yet: `stars.json` comes from corpus-embed (not done); e2e uses a synthetic fixture.
- FPS: 60 (vsync cap) with 20,000 synthetic stars while orbiting, headed Chromium on the agent's Mac. Not yet measured on the demo laptop, which is unknown.
- No camera flights exist, so `prefers-reduced-motion` only turns off orbit damping.
