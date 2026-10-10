## What shipped
`components/plan` (default export `PlanStep`): the Plan step for the active version. Hours left and team size (prefilled 10 and 2, bounded like the API) → "Plan this idea" shows the demo tour, cut list, timeline (as +hours) and risks with countermeasures, each line with its worded `ClaimBadge`. "Regenerate" makes a new plan and keeps the earlier one readable below. The newest stored plan loads with `GET`; loading, empty, generating and failed (with Retry) use `PanelState`. experience-shell mounts it (#321). The newest plan stays readable under "Earlier plan" while a regenerate runs or after it fails.
## Where it lives
`components/plan/` (`index.tsx` container, `PlanView.tsx`, `plan.ts`, `plan.module.css`); `tests/build-plan-ui/view.test.ts`, `tests/e2e/build-plan-ui/plan.spec.ts`.
## How to check it
verify: `node scripts/verify.mjs build-plan-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/build-plan-ui/20261010T221350Z` pass at 9cb9a15. The e2e saves an idea, plans it from a stub (four sections with worded badges, screenshot `plan.png`), fails a regenerate through a stubbed 503 (alert + Retry, earlier plan still listed, `failed.png`), then retries to a new plan. Against the old container it fails on the missing earlier plan.
## Gaps
No live plan: Gemini is out of credit (#297). Earlier plans are kept only for the session; the API returns only the newest.
