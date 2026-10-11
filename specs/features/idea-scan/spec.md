---
name: The scan - a new idea reaches out to its real nearest projects, one by one, with their real similarity
depends_on: [galaxy-3d, idea-create-ui]
owns: [components/scan/, components/galaxy/, app/api/scan/, lib/scan/, tests/idea-scan/, tests/e2e/idea-scan/]
assignee: "eric-claude-agent-3"
---

# Idea scan

The demo's central moment (person, 2026-10-11: "this is our most important demo part"). Today a new idea appears with
its five neighbour arcs already drawn: it's correct, but nothing happens on screen. The reference video the
person shared (a "prompt crawler": one bright subject among thousands of dim points, tentacles reaching out to
labelled targets, chapters, a HUD where every panel reacts to the same event, ending "181 words read · 12 flagged ·
0 guessed") works because it shows the work happening, colour means progress, and the honesty is the payoff. This
feature does that with our real data: the idea is scanned against the field, and you watch it happen.

## Plan
1. `GET /api/scan/<versionId>` (workspace-scoped, read-only, no model call): the version's stored neighbours, each
   `{ id, title, url, similarity }`, where similarity is cosine between the version's stored embedding and the
   project's (`1 - (a <=> b)`), sorted high to low; plus `searched`, the number of projects in the version's
   corpus version. Logic in `lib/scan/`. 404 for a version outside the workspace.
2. The scan, in the galaxy, when the active idea changes to one the scan hasn't played for in this page:
   - **Drain** (~0.5 s): every corpus star fades toward a cool grey, so the field reads as unscanned.
   - **Fly** (~1 s): the camera eases to frame the idea and its neighbours (`Orbit` spring from the current view).
   - **Reach** (~0.35 s apart, closest first): one arc at a time draws from the idea out to a neighbour; when it
     lands the neighbour lights in its category colour with a short flash, and a tag beside it reads its title (cut
     at 28 characters) and its similarity (`0.83`). The neighbour's whole category cloud warms back toward colour.
   - **Settle**: the rest of the field comes back as today's idea focus (neighbours bright, others dimmed); tags
     stay while the idea is focused; the arcs keep flowing as today.
   It is interruptible: any drag, wheel or selection ends it at once in its settled state. "Replay" plays it again.
3. The scan readout (`components/scan/`), over the galaxy's lower left in the observatory style (Plex Mono data,
   brass rules, idea cyan as the one accent): a header `SCAN` with the phase (`draining · flying · linking 3/5 ·
   done`), a log line per landed arc (`link  0.83  <title>`), and a footer ledger: `<searched> projects searched ·
   5 nearest linked · closest 0.83 · 0 invented`. A log line is a button that selects its project. Collapses to the
   ledger line on a phone.
4. The intro (cold open), at `/?intro` and from an "Intro" button beside the map controls: the field starts grey,
   each category cloud lights in turn (largest first, ~0.45 s apart) with its label and real count, prize winners
   glint, then the camera pulls back to the whole map. Any input skips it. It never plays on its own on a plain
   `/`, so no other suite's first frame changes.

## Requirements
- Every number shown is read from data: similarity from the API (never 3D distance, never estimated client-side),
  counts from `stars.json`/`classes.json`/the API. If the scan API fails, arcs still play from the stored neighbour
  ids, tags show the title only, and the ledger says `similarity unavailable` rather than a number.
- The animation never waits on the network: it starts on the stored neighbours; similarity fills in when it lands.
- Reduced motion: no drain, flight, reach or intro; the settled state shows at once (tags, log and ledger in full).
- Never presents grey or empty space as opportunity or originality; the copy says "searched", "nearest", "linked".
- No new dependency; no change to `stars.json`, the idea API or any other feature's panel. Galaxy draw cost stays
  one point buffer: the drain and warm-up are a per-star uniform/attribute, not a re-upload per frame.
- Keyboard: Replay, Intro and each log line are buttons; the ledger is a polite live region announcing `done`.

## Validation
1. `GET /api/scan/<versionId>` for a version in the workspace -> 200, five neighbours equal to the version's
   `neighborIds`, similarity in [-1, 1], sorted descending, matching pgvector's cosine for that pair to 1e-6;
   another workspace's version -> 404; no workspace -> 401.
2. Create an idea (text path) -> within 6 s the galaxy has `data-scan="done"`, five tags each a real title from
   `stars.json` with a similarity equal to the API's (to 2 decimals), and the ledger reads `... projects searched ·
   5 nearest linked · closest <top similarity> · 0 invented`. Mid-scan, `data-scan` passes through `reach` and the
   tags appear in descending similarity.
3. A drag during the scan -> `data-scan="done"` on the next frame. Replay -> it plays again.
4. `prefers-reduced-motion` -> `data-scan="done"` on the first frame with all five tags shown.
5. `/?intro` -> `data-intro` passes `play` then `done`, each region label appears; `/` -> no `data-intro="play"`.
6. Scan API stubbed to 500 -> arcs and title tags still appear; ledger says `similarity unavailable`.
7. `tests/e2e/idea-scan/` covers 2-6 with desktop and phone screenshots per phase; the galaxy-3d, galaxy,
   galaxy-classes-ui, galaxy-history, experience-shell and idea-create-ui suites still pass.

## Defaults
Five neighbours (what the idea API stores). Undo: remove the scan state from `components/galaxy/index.tsx`; the
arcs fall back to today's focus.
