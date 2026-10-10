---
name: The camera flies to the idea, the chosen version or a search hit and frames its neighbors
depends_on: [galaxy, galaxy-history, idea-create-ui, search]
owns: [components/galaxy/, tests/camera-flight/, tests/e2e/camera-flight/]
assignee: ""
---

# Camera flight (F01 polish)

Frontend: Mac workers. Today the camera never moves on its own (galaxy Gaps): a new idea star can appear
off-screen, and a search hit lights a star the user has to hunt for. The demo's first beat is "your idea becomes a
star among real projects"; the camera should take the judge there.

## Plan
1. In `components/galaxy/`, a flight that moves the camera target and distance over about 1.2 s with easing, then
   hands control back to `OrbitControls`.
2. Triggers, read from `lib/store.ts`: `activeIdeaVersionId` changes (new star, revision, branch), and a search
   result is chosen (`selectedProjectId`).
3. Framing: fit the target and the stars in `highlightedIds` (its neighbors) in view, with margin.

## Requirements
- Any user drag, wheel or key during a flight cancels it at once; the camera stays where the user left it.
- `prefers-reduced-motion: reduce` -> the camera cuts to the final view with no animation.
- No flight while a selection's panel holds the camera still (existing rule in `Scene.tsx`).
- Frame rate during a flight stays at the galaxy's current measure (60 with 20,000 stars on the agent's Mac).
- The keyboard project list is unchanged; the flight is a visual aid, never the only way to reach a star.

## Validation
1. Save an idea -> the camera ends with the idea star and its neighbors on screen (e2e checks the star's projected
   position is inside the canvas).
2. Choose a search result far from the current view -> the camera ends on that star.
3. Drag during a flight -> the flight stops; the next frame's camera matches the drag.
4. Reduced motion emulated -> the final view is reached in one frame.
5. `tests/camera-flight/` pins the framing math (all given points inside the frustum).

## Defaults
Neighbors unknown (no highlights) -> frame the target alone at the default distance.
