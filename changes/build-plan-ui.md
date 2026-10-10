## What shipped
`components/plan` (default export `PlanStep`): the Plan step for the active version. Hours left and team size (prefilled 10 and 2, bounded like the API) → "Plan this idea" shows the demo tour, cut list, timeline (as +hours) and risks with countermeasures, each line with its worded `ClaimBadge`. "Regenerate" makes a new plan and keeps the earlier one readable below. The newest stored plan loads with `GET`; loading, empty, generating and failed (with Retry) use `PanelState`. Not mounted yet: experience-shell places it (#299).
## Where it lives
`components/plan/` (`index.tsx` container, `PlanView.tsx`, `plan.ts`, `plan.module.css`); `tests/build-plan-ui/view.test.ts`.
## How to check it
not verified: `verify.py` needs `tests/e2e/build-plan-ui/`, which needs the panel mounted (experience-shell, #299). Checked instead: `tests/build-plan-ui/view.test.ts` server-renders every state (four sections with worded badges, earlier plan, loading/empty/generating, failed + Retry, input bounds; a removed badge fails it). Mounted locally (uncommitted) at 1440 and 390 wide with the plan route stubbed: generate and regenerate worked, no horizontal overflow, all controls focusable.
## Gaps
Browser e2e (Validation 1–2) waits for the shell mount. No live plan: Gemini is out of credit (#297). Earlier plans are kept only for the session; the API returns only the newest.
