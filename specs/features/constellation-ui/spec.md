---
name: See the idea's assumptions as a small map, each opening its evidence and its test
depends_on: [change-mind-ui]
owns: [components/challenge/, tests/constellation-ui/, tests/e2e/constellation-ui/]
assignee: ""
---

# Assumption constellations (F24)

Frontend only: Mac workers (user decision 2026-10-10). No API half: it reads the assumptions change-mind-api already stores, through the existing `GET /api/assumptions/:versionId`, and makes no model call. The challenge panel is done, so this feature owns `components/challenge/` and renders inside it.

## Plan
1. In the challenge panel, "Assumption map": an SVG with the idea at the centre and four labelled clusters, need, data, feasibility and differentiation, holding that kind's assumptions as nodes.
2. An edge joins two assumptions only when they cite at least one same source project (`sourceIds`). No other edges: connections are never inferred from wording.
3. Selecting a node opens its assumption with its `ClaimBadge` (the uncertainty), the cited projects (each opens the project drawer), and its test: what to observe and the result that would reverse it, or "evidence is insufficient".

## Requirements
- Every node is a keyboard-reachable button with the assumption as its accessible name; the existing list stays as the text equivalent.
- No continuous motion; `prefers-reduced-motion` removes transitions. Labels carry text, never colour alone.
- No assumptions yet -> `PanelState` empty, pointing at "What would change your mind?".
- The challenge, prove-it and change-mind e2e suites still pass unchanged.

## Validation
1. Fixture assumptions (stubbed route) with two citing the same project and one citing none -> exactly one edge; every node sits in its kind's cluster.
2. Select a node -> its claim, label, cited projects and test show; select an `insufficient` node -> "evidence is insufficient"; select a cited project -> the drawer opens on it.
3. `tests/e2e/constellation-ui/` covers 1–2 including keyboard selection, and `tests/e2e/challenge-ui/`, `tests/e2e/prove-it-ui/` and `tests/e2e/change-mind-ui/` still pass. Keep a screenshot at desktop and phone widths.

## Defaults
Static layout (four fixed cluster positions); no force simulation, no new dependency.
