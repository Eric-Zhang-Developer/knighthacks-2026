## What shipped
The galaxy is a flat 2D map: drag to pan (with a glide), wheel or pinch to zoom about the pointer, no rotation. Selecting a project springs the view to it; zoom in / out / whole-map buttons and the + - 0 keys. Each category's region glows in its hue (fading as you zoom in), stars grow a little when close, and the canvas only draws when something changes.
## Where it lives
`components/galaxy/view.ts` (view maths, picking grid), `components/galaxy/Scene.tsx`, `components/galaxy/index.tsx`, `components/galaxy/galaxy.module.css`, `tests/galaxy-2d/`, `tests/e2e/galaxy-2d/`
## How to check it
verify: `node scripts/verify.mjs galaxy-2d …/agent-evidence/galaxy-2d/20261010T225554Z` pass at 2004991
## Gaps
Draws today's x/y (a top-down view of the 3D layout) until corpus-layout-2d ships true 2D positions. The category glow needs `classes.json`, which isn't published yet (#285): until then the map is one neutral hue. 60 fps at ~55k stars is designed for (grid picking, on-demand drawing) but not measured: the bigger corpus doesn't exist yet. Neighbour suites pass except galaxy's console-error test, which fails on main's /api/workspace/state 401 (#288).
