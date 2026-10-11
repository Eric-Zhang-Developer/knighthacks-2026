## What shipped
- **Team profile:** a revisioned team profile (`/api/decision-context/profile`), where unknown fields stay unknown.
- **Recommendations:** scope recommendations for a saved version. The model proposes candidate features and what each needs; app code sets core, optional or later from the exact saved profile, with each influence and gap shown.
- **Selections:** append-only, giving a core-only demo sketch.
- **Snapshots:** the latest selection freezes into a snapshot and its public share. Stale writes return 409.
## Where it lives
`lib/decision-context/`, `app/api/decision-context/`, `db/schema/decision-context.ts`, `lib/snapshots/{contract,service}.ts`, `specs/decisions/decision-context-api-schema.md`, `tests/decision-context-api/`, `tests/e2e/decision-context-api/`
## How to check it
verify: `node scripts/verify.mjs decision-context-api /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/decision-context-api/20261011T074905Z` pass at f84b206 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/decision-context-api/20261011T074905Z)
Run with `DATABASE_URL` = `TEST_DATABASE_URL`, a fresh absolute `AI_STUB_DIR` and `AI_STUB_ALLOW=1`. One live run (no stub, test DB) is in `live-scope.json` in the evidence: 201 in 18 s, a sensor feature "later" for a laptop-only team, and two 2 h features core within 4 h.
## Gaps
- **Production tables:** the tables exist on the test branch only. Production needs `scripts/db-sync.mjs --apply` from a clean `origin/main` after merge (not run here).
- **Skill matching is literal:** a substring match, so a skill named differently from the team's wording counts as missing. The prompt asks for the team's wording, which the live run followed.
- **Provider schema:** Gemini rejects this schema with its limits written in, so the limits are checked after generation (with one retry) instead.
