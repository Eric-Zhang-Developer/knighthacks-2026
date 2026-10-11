---
name: A flat, pannable 2D star map instead of an orbiting 3D cloud
depends_on: [galaxy, galaxy-classes-ui, experience-shell]
owns: [components/galaxy/, tests/galaxy-2d/, tests/e2e/galaxy-2d/]
assignee: "eric-frontend-agent"
---

# Galaxy 2D

Superseded by `galaxy-3d` (person, 2026-10-10, evening): the map is 3D again, with a by-category and a by-meaning
layout. This spec records what shipped in #332.

Frontend only: Mac workers (user decision 2026-10-10, owner eric-frontend-agent). The person: rotating a 3D cloud adds
nothing for reading the map; it should be 2D, and fancy. This replaces the orbit camera, not the data: positions
still come from `public/corpus/stars.json`. Until `corpus-layout-2d` ships a true 2D layout, the map draws `x, y` and
ignores `z` (a top-down view of today's layout).

Visual target: `docs/design-references/desktop.png` and `phone.png` (the person's references, read with their
README): luminous category clusters with labelled counts, a glowing idea anchor, glass panels, chip filters, an icon
navigation bar. Mockup numbers and names are illustrative and are never shown as data.

## Plan
1. Orthographic, top-down camera. Drag pans, wheel and pinch zoom about the pointer, with no rotation. Zoom is
   clamped between the whole map and about 40 stars across the view.
2. Motion (apple-design skill): pan carries the release velocity and decelerates (projection rate 0.998); zoom and
   "fly to a project" are critically damped springs (response 0.4 s) that start from the current view, so a new
   drag or wheel interrupts them. Selecting a project from the list, search or drawer flies to it. With reduced
   motion, the view jumps.
3. Look: each category's stars sit on a soft nebula of their own hue (a static, additive glow layer under the
   points; neutral without `classes.json`). Selected and highlighted stars keep their marks and prize rings; region
   labels stay screen-sized at any zoom. No continuous decorative motion.
4. Map controls (Material 3 small icon buttons) at the map's bottom-right corner, above the count (the top-right
   corner is the galaxy suite's "empty space" click): zoom in, zoom out, fit all. Keyboard: `+`, `-`
   and `0` when the map has focus.
5. Picking, the reveal mask, idea stars and focus lines work as before, in 2D.

## Requirements
- Stars never move relative to each other: panning and zooming change only the view (the e2e reads the position
  buffer, as `galaxy` does).
- 60 fps pan and zoom on the full corpus on a 2020+ laptop, sized for the growth release (#317, up to ~55k stars):
  one draw call for stars, as now, and picking that doesn't project every star on each pointer move.
- Reduced motion: no spring or momentum, only instant view changes.
- The canvas draws on demand: only while the view moves or the stars' styles change, never at idle (battery, and
  the page stays responsive under software rendering).

## Validation
1. Drag the map 200px right: two stars' screen positions both move 200px right (±2) and the distance between them
   is unchanged; nothing rotates.
2. Wheel-zoom in over a star: that star's screen position stays put (±3px) while the distance between two other
   stars grows.
3. Pick a project in the list: within 1 s the view settles with that star at the map's centre (±4px); with
   `prefers-reduced-motion`, it's there in the next frame.
4. "Fit all" shows every star inside the map. `+`, `-` and `0` do the same as the buttons.
5. `tests/e2e/galaxy-2d/` covers 1–4 with desktop and phone screenshots, and the galaxy, galaxy-history,
   galaxy-classes-ui, galaxy-explainer and experience-shell suites still pass.

## Defaults
three.js `OrthographicCamera` and the existing points shader; pan, zoom and springs are a few lines of our own
(no new dependency).
