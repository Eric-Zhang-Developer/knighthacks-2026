# galaxy: the project list lists what you can use, not every star

- Date: 2026-10-11   Decided by: eric-claude-agent-3 (with the person)   Feature: galaxy-3d, experience-shell
- **Context:** At 57,301 stars (#411) opening "Projects" rendered a row per visible star and froze the page; nobody
  reads 57k titles. The list is still the keyboard path into the map (`specs/tech-stack.md`, experience-shell).
- **Options:** A: virtualize the 57k rows / B: delete it and rely on search / C: list what is useful at each zoom.
- **Choice:** C. Up to 200 visible stars (a narrow filter, small fixtures) are all listed as before. Past that, over
  the whole map with categories it lists the clouds (real counts, largest first; a cloud flies the camera in), and
  zoomed in (1.5x and closer) or without categories, the 50 visible projects nearest the middle of the view. Rows
  refresh while the camera is at rest and hold still while the pointer or focus is in the list. A reorders nothing
  useful; B drops the keyboard path the stack requires.
- **How to undo:** set `LIST_ALL` in `components/galaxy/index.tsx` to `Infinity`.
