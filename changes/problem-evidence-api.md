## What shipped
Immutable workspace-scoped problem evidence from Gemini grounding, with cited claims, inferred relevance and server-derived dates; no ungrounded fallback.
## Where it lives
`app/api/problem-evidence/`, `lib/problem-evidence/`, `lib/ai/grounded.ts`, `db/schema/problem-evidence.ts`; owned unit/e2e tests and schema decision.
## How to check it
verify: `node scripts/verify.mjs problem-evidence-api /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/problem-evidence-api/20261010T180123Z` pass at 6b84d02. Live Gemini `gemini-3.8-flash`: 8 supported problem findings; resolved domains www.circularonline.co.uk, www.rural21.com, sites.mitre.org; publication timestamp 2025-03-20T09:32:13+00:00 and event text 2024. Fixture run 20261010T180006Z passed; 274 unit tests, typecheck and lint passed; saved rows and grounding receipts retained.
## Gaps
Production table application remains coordinated under #113; only TEST_DATABASE_URL changed. Five live items retained unresolved URLs as null with grounding domain vertexaisearch.cloud.google.com; other unavailable dates remain null. No frontend integration or corpus changes. All Validation steps ran.
