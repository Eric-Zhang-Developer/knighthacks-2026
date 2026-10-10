## What shipped
`components/scorecard` (default export `ScorecardPanel`): "Score this idea" on the active version shows five rows in rubric order, each with the criterion, the score as text ("4 out of 5") and a meter, its label, and expandable points for and against with worded badges. A cited project is a button that opens the drawer. A null score reads "evidence is insufficient" with no meter. No total and no odds. The newest scorecard loads with `GET`; loading, empty, scoring and failed (with Retry) use `PanelState`. experience-shell mounts it (#321).
## Where it lives
`components/scorecard/` (`index.tsx` container, `ScorecardView.tsx`, `scorecard.ts`, `scorecard.module.css`); `tests/idea-scorecard-ui/view.test.ts`, `tests/e2e/idea-scorecard-ui/scorecard.spec.ts`.
## How to check it
verify: `node scripts/verify.mjs idea-scorecard-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/idea-scorecard-ui/20261010T223144Z` pass at bc95bc0. The e2e saves an idea, scores it through the real route with stubbed model output (five rows in rubric order, scores as text, four meters, Design "evidence is insufficient", labels as the route grounds them; `scorecard.png`), then clicks the cited neighbour and the drawer shows it (`drawer.png`).
## Gaps
No live scorecard: Gemini is out of credit (#297).
