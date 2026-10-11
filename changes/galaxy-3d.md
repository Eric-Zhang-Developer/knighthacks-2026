## What shipped
The galaxy is 3D again: a perspective camera that orbits (drag turns it, wheel or pinch zooms, idle drift), and two layouts of the same stars behind a "By category / By meaning" toggle mirrored in `?layout=clouds|nebula` (default clouds). Switching flies every star across in about 1.4 s (instant with reduced motion). Glowing stars, cloud labels projected from 3D, idea arcs, fly-to on select, and right/shift-drag panning held while a project is selected. The 2D viewport and its tests are gone.
## Where it lives
`components/galaxy/` (`Scene.tsx`, `view.ts` camera, `layouts.ts`, `morph.ts`, `index.tsx`, `galaxy.module.css`), `tests/galaxy-3d/`, `tests/e2e/galaxy-3d/`
## How to check it
verify: `node scripts/verify.mjs galaxy-3d …/agent-evidence/galaxy-3d/20261011T013548Z` pass at c1e12e4
## Gaps
Motion smoothness and the real-GPU look were checked only in headless SwiftShader; the person checks the deployed site. Once, in headed Chromium on an M2, the view looked about 3x closer with identical camera numbers: unexplained, and not reproduced in headless. The flat background rings in `app/page.module.css` weren't this PR's; #375 removed them. Validation 6's neighbour suites pass (galaxy-history, galaxy-classes-ui, galaxy-explainer, the rest of galaxy and experience-shell) except two that fail the same way on origin/main 5fb6eba: galaxy's console-error test (/api/workspace/state 401, #288) and experience-shell's desktop sizes (the canvas is measured at its default 300 px before it's sized). No Validation step was skipped.
