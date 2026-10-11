## What shipped
Immutable workspace-scoped cited problem evidence; grounding and relevance classification now receive the same saved problem, audience, workflow and constraints. Unknown context remains null; supported claims and inferred relevance retain their labels.
## Where it lives
`app/api/problem-evidence/`, `lib/problem-evidence/`, `lib/ai/grounded.ts`, `db/schema/problem-evidence.ts`, and owned unit/e2e tests.
## How to check it
Context regression reproduced twice before the fix; 35 focused and 538 full-suite tests passed (2 skipped), plus TypeScript and ESLint. Previous live verification at cf98ef7 returned 8 items via gemini-3.8-flash with cited domains and server-derived dates; this is historical evidence, not a new live-context result.
## Gaps
New local built-app verification did not reach tests: the shared ElevenLabs dependency install lacks generated modules; CI/Vercel build checks passed. Live grounding Validation 1 was not repeated for this fix. Existing snapshots stay immutable; unknown URLs/dates remain null. No new user trial.
