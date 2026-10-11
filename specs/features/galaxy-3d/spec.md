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
   the wheel and pinch zoom toward the pointer, with limits; a right-drag, or an option-, ctrl- or cmd-drag, turns it
   (about a third of a circle per 300px; person, 2026-10-11: "I can't rotate with the left or right mouse button").
   While a project is selected the camera holds on it: any drag circles it, zoom stays on it. After 20 s untouched it drifts round whatever it's looking at (about once per 105 s);
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
4. Look: over the whole map, soft additive stars with a hot core and a halo in the category's hue, depth-dimmed; a
   faint glow per cloud; a far starfield and dust for depth; a single full-screen pass for glow and tone mapping.
   Labels are HTML from 3D ("Health & wellbeing · 774"); far-side labels fade and overlapping labels yield to the
   nearer one. Zooming in sharpens the stars (person, 2026-10-11: "the fuzziness when you're up close… kind of
   sucks"): from 1.3x to 3.5x the whole-map view, each star tightens into a white-hot pinpoint with a short glow in its hue
   (person, 2026-10-11, of flat discs: "these dont look like stars"), keeping its own brightness, with four faint
   spikes on the brightest, and the cloud glow, bloom and white bleach fade out, so a dense core
   reads as separate projects; stars spread apart as the camera closes in rather than swelling. A prize winner is a
   star inside a thin ring of a fixed width, at full brightness. From 4x in, the stars nearest the map's centre that
   stand apart (no other star drawn within 16px; person, 2026-10-11, at 57k stars: names "coming out way too early")
   are named (their real title, cut at 28 characters): at most 10, near side only, none covering another or a
   cloud's name, each a button that selects its project; none while a project is selected or the stars are flying.
   The camera zooms in to 50x (was about 17x), so a dense core can separate into single stars.
5. Idea focus: dotted arcs from the active idea (placed among its neighbours in the current layout) to each
   neighbour, with a pulsing ring at the idea; other stars dim. Selecting a project flies the camera to it and
   rings it; clearing the selection eases back to the whole view.
6. Picking, the reveal mask, legend filters, prize rings and history work in both layouts and mid-flight.
7. Remove the 2D `Viewport`, `StarGrid` and `boundsOf` code and `tests/galaxy-2d/`, `tests/e2e/galaxy-2d/`; their
   checks move to `tests/galaxy-3d/` and `tests/e2e/galaxy-3d/`.
8. Plain stars (person, 2026-10-11, on "By meaning": "how the fuck do I read this?… What if we just added a filter
   to drop color… a toggle", placed "bottom left under projects"). A "Hide category colors" toggle under the project
   list gives every star the neutral blue-white; the active idea's neighbours keep their category colour, so a scan
   lights its matches against a plain field. Kept in the URL as `?colors=off`. "By meaning" shows no category labels:
   a category spans the whole map there, so its centre is the middle and the labels piled up on each other.

9. Framing and filters (the planner's UI audit, #465 #459 #476 #472). The whole-map view frames the layout's median
   star, not 0: the 76,316-project release sits low (median y -0.28), so "By meaning" had drawn at the bottom of the
   screen. The search's event filter narrows the map's stars too, so the map, list and legend count the same stars.
   On a phone the layout toggle is a 44 px tap target and fits beside "Browse the map" at 360 px. Counts are
   formatted ("Projects (76,316)").

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
6. `tests/e2e/galaxy-3d/` covers 2-5 and 7 with desktop and phone screenshots, and the galaxy, galaxy-history,
   galaxy-classes-ui, galaxy-explainer and experience-shell suites still pass.
7. Zoomed into a cloud, stars are separate points (`sharp.spec.ts`, into Productivity & work at about 5.8x): in a
   240px box at the map's centre, the share blown out (brightest channel above half) is at most a third of before the
   change (49.4% on cd9b1b7) and the bright local peaks are no fewer (398). Over the whole map no project is named;
   in the cloud's core any name shown is on a star with no other within 16px; closer in (about 37x), 1 to 10 are,
   each a real title from `stars.json` on such a star, and clicking one selects that project. Unit
   (`tests/galaxy-3d/sharp.test.ts`): sharpness is 0 at the fit view, 1 at the closest zoom, never falling as you zoom
   in; the name picker returns at most 10 near-side stars with no two names overlapping, skipping a cloud's name,
   and names none with another star drawn within 16px (a dense field has none; a lone star beside it is named).
8. `plain.spec.ts`: "By meaning" has no "Go to <category>" labels ("By category" has them). Of the lit pixels in a
   320px box at the map's centre, more than 30% have a hue outside the plain stars' blue-white before "Hide category
   colors" and under 5% after; the toggle is pressed, `?colors=off` is in the URL and survives a reload, and pressing
   it again removes both.

## Defaults
"By category" is the default because it reads at a glance; "By meaning" is one tap away. Undo: set the default
in `index.tsx` back to `nebula`.
