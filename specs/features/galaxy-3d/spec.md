---
name: A 3D galaxy with two layouts, by category and by meaning, and the stars flying between them
depends_on: [galaxy-2d, galaxy-classes-ui]
owns: [components/galaxy/, tests/galaxy-3d/, tests/e2e/galaxy-3d/, tests/galaxy-2d/, tests/e2e/galaxy-2d/]
assignee: "eric-frontend-agent"
---

# Galaxy 3D

Frontend only (person's decision 2026-10-10, evening, after a side-by-side prototype on branch `galaxy-3d-proto`):
the flat map stays unreadable because categories are smeared across the whole layout (each category's spread is
57-108% of the whole map's), and the person wants 3D: "2D's boring". This replaces `galaxy-2d`'s flat view. It
needs the real `z` in `public/corpus/stars.json`, so `corpus-layout-2d` (which would write `z = 0`) is cut.

Visual target: the person's reference video (a dark "data crawler": dense glowing point clouds, one per section, thin
monospace labels, a camera that follows the action) and the prototype's screenshots.

## Plan
1. Perspective camera that moves like a map (person, 2026-10-10: "you can only zoom in on one singular point"): a
   drag moves across the galaxy with what's under the pointer staying under it, and a release glides on and slows;
   the wheel and pinch zoom toward the pointer, with limits; option-, ctrl- or cmd-drag turns it (about a third of a
   circle per 300px). While a project is selected the camera holds on it: a drag circles it, a right-drag does
   nothing, zoom stays on it. After 20 s untouched it drifts round whatever it's looking at (about once per 105 s);
   any input stops the drift. Zoom in, zoom out, fit and "fly to a project" are critically damped springs from the
   current view (apple-design). The map buttons and the `+`, `-`, `0` keys keep working. A cloud's label is a
   button that flies to that cloud.
2. Two layouts of the same stars, `components/galaxy/layouts.ts`:
   - **By category** (default): one dense cloud per category key (`keyOf` in `lib/classes`, so "mixed" and "not
     enough text" get their own), arranged on a flattened disc with no overlaps. Inside a cloud each star keeps its
     real embedding offset from the category's centre, so similar projects still sit together.
   - **By meaning**: the real `x, y, z` from `stars.json`, unchanged.
   Without `classes.json`, "By category" falls back to "By meaning".
3. A "By category / By meaning" toggle on the map, mirrored in the URL (`?layout=clouds|nebula`). Switching flies
   every star from one layout to the other (about 1.4 s, centre first, rim last, each path bowing outward);
   switching again mid-flight turns them around from where they are.
4. Look: soft additive stars with a hot core and a halo in the category's hue, depth-dimmed; a faint glow per
   cloud; a far starfield and dust for depth; a single full-screen pass for glow and tone mapping. Labels are HTML
   from 3D ("Health & wellbeing · 774"); far-side labels fade and overlapping labels yield to the nearer one.
5. Idea focus: dotted arcs from the active idea (placed among its neighbours in the current layout) to each
   neighbour, with a pulsing ring at the idea; other stars dim. Selecting a project flies the camera to it and
   rings it; clearing the selection eases back to the whole view.
6. Picking, the reveal mask, legend filters, prize rings and history work in both layouts and mid-flight.
7. Remove the 2D `Viewport`, `StarGrid` and `boundsOf` code and `tests/galaxy-2d/`, `tests/e2e/galaxy-2d/`; their
   checks move to `tests/galaxy-3d/` and `tests/e2e/galaxy-3d/`.

## Requirements
- No new dependency: the camera, morph and glow pass are our own code on three.js and react-three-fiber.
- Renders on real GPUs, not only software GL: the final pass writes premultiplied colour with a real alpha (alpha
  0 made a hardware compositor drop every star while SwiftShader still drew them).
- Reduced motion: no drift, twinkle or springs; a layout switch is instant.
- Layouts are deterministic and run in the browser in well under 20 ms on today's corpus.
- Phone: the map keeps usable space and labels don't cover it.

## Validation
1. Unit (`tests/galaxy-3d/`): both layouts return 3 values per star, centred, inside ±0.5, and the same output
   twice; "By meaning" equals `stars.json`; "By category" without classes equals "By meaning"; no two stars of
   different categories closer than 0.02; inside each cloud, the rank correlation of pairwise distances with the
   real layout is above 0.9.
2. `/?layout=clouds` and `/?layout=nebula` each load with `data-layout` set to match; with no parameter it's
   `clouds`.
3. Clicking "By meaning" sets `?layout=nebula`; a frame mid-flight has positions that equal neither layout, and
   within 2.5 s the position buffer equals the nebula layout (±1e-4). With `prefers-reduced-motion`, it equals it on
   the next frame.
4. Dragging moves the view, not the stars: a star's screen position follows the drag (±3 px when released still)
   while the position buffer does not change. Wheel-zooming in over a point keeps the star nearest the pointer
   within 8 px of where it was while the gap between two other stars grows. Clicking a cloud's label brings that
   cloud's centre within 12 px of the map's centre. Unit (`tests/galaxy-3d/view.test.ts`): drag and zoom keep the
   point under the pointer to 0.5 px through a real three.js camera; selected, nothing pans; the drift waits 20 s.
5. Picking a project in the list puts its star at the map's centre (±6 px) within 1.5 s; "fit" brings at least
   97% of stars inside the map in either layout.
6. `tests/e2e/galaxy-3d/` covers 2-5 with desktop and phone screenshots, and the galaxy, galaxy-history,
   galaxy-classes-ui, galaxy-explainer and experience-shell suites still pass.

## Defaults
"By category" is the default because it reads at a glance; "By meaning" is one tap away. Undo: set the default
in `index.tsx` back to `nebula`.
