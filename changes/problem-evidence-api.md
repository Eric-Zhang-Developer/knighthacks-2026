## What shipped
Immutable workspace-scoped Gemini problem evidence with cited claims, inferred relevance and server-derived dates; unresolved redirects now retain a valid grounding-title domain instead of naming Google's redirect service, while known resolved/direct hosts stay intact.
## Where it lives
`app/api/problem-evidence/`, `lib/problem-evidence/`, `lib/ai/grounded.ts`, `db/schema/problem-evidence.ts`; owned unit/e2e tests and schema decision.
## How to check it
verify: `node scripts/verify.mjs problem-evidence-api "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\problem-evidence-api\20261010T183949Z"` pass at cf98ef7. Live gemini-3.8-flash:8 problem items; domains emerald.com, epa.gov, frontiersin.org, guelphfamilyhealthstudy.com, knowledge-for-policy.ec.europa.eu, nrdc.org, pubmed.ncbi.nlm.nih.gov, stopfoodlosswaste.org;3 resolved URLs; publication2026-08-05T11:57:25-04:00 and event2024. Fixture20261010T183553Z passed;292 unit tests, typecheck/lint passed.
## Gaps
Production schema remains coordinated under #113; only TEST rows were created. Five live URLs remain null; unknown domains/dates stay empty/null, never inferred from prose. Existing immutable snapshots keep their original data. One deployment-only Foreman test skipped; no user trial. DNS/SSRF, redirect, size and timeout protections unchanged; all spec Validation ran.
