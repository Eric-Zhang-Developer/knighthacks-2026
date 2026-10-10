## What shipped
`components/scorecard` (default export `ScorecardPanel`): "Score this idea" on the active version shows five rows in rubric order, each with the criterion, the score as text ("4 out of 5") and a meter, its label, and expandable points for and against with worded badges. A cited project is a button that opens the drawer. A null score reads "evidence is insufficient" with no meter. No total and no odds. The newest scorecard loads with `GET`; loading, empty, scoring and failed (with Retry) use `PanelState`. Not mounted yet: experience-shell places it (#299).
## Where it lives
`components/scorecard/` (`index.tsx` container, `ScorecardView.tsx`, `scorecard.ts`, `scorecard.module.css`); `tests/idea-scorecard-ui/view.test.ts`.
## How to check it
not verified: `verify.py` needs `tests/e2e/idea-scorecard-ui/`, which needs the panel mounted (experience-shell, #299). Checked instead: `tests/idea-scorecard-ui/view.test.ts` server-renders every state (five rows, meters, worded badges, the insufficient-evidence row, no total, failed + Retry). Mounted locally (uncommitted) at 1440 and 390 wide with the route stubbed: scoring rendered, a cited project opened the drawer at both widths, no horizontal overflow.
## Gaps
Browser e2e (Validation 1–2) waits for the shell mount. No live scorecard: Gemini is out of credit (#297).
