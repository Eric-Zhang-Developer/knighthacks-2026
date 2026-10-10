---
name: An explorable 3D galaxy of the corpus: zoom, pan, hover and select stars
depends_on: [bootstrap]
owns: [components/galaxy/, tests/galaxy/, tests/e2e/galaxy/]
assignee: ""
---

# Galaxy (F01)

## Plan
1. React Three Fiber canvas; load `public/corpus/stars.json`; draw every star in one `THREE.Points` buffer.
2. Orbit, zoom and pan; hover shows the title; click sets `selectedProjectId`.
3. Stars in `highlightedIds` and `ideaStars` (from the store) render distinct by colour *and* size.
4. A keyboard-reachable list of the same projects beside the canvas.

## Requirements
- One draw call for the corpus, never one component per star.
- Selecting a star sets the store; the camera doesn't move while a panel is open.
- `prefers-reduced-motion` turns off camera flights.
- With no `stars.json`, show "corpus not loaded", not an empty canvas.
- Dev fixtures with made-up coordinates live only under `tests/galaxy/` and are labelled synthetic.

## Validation
1. Open `/` -> the galaxy renders the `count` from `stars.json`.
2. Click a star -> `selectedProjectId` is that star's ID (the e2e test reads it).
3. Tab into the list, press Enter on an item -> the same selection.
4. `tests/e2e/galaxy/` covers 1–3; keep a screenshot. Record the FPS on the demo laptop in the done note.

## Defaults
Cyan for the selected idea, near-black background, colour always paired with size or label.
