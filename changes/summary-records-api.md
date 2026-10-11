## What shipped
- **Model prompts:** when a neighbour has no description on record (a gallery card: title and tagline only), the evidence, strongest-alternative, combinations and challenge prompts flag that source (`galleryCardOnly` plus a note) and add a rule against claiming how it works beyond that text. Prompts for full projects are byte-identical to before.
- **Evidence cards:** gain `excerptSource` (`description | tagline | title | unknown`), matched on read against the project's current text.
- **Search:** hits gain `summaryOnly`.
## Where it lives
`lib/evidence/{contract,service}.ts`, `lib/alternative/service.ts`, `lib/combinations/service.ts`, `lib/challenge/service.ts`, `lib/search/neighbors.ts`, `tests/summary-records-api/`, `tests/e2e/summary-records-api/`
## How to check it
verify: `node scripts/verify.mjs summary-records-api /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/summary-records-api/20261011T082129Z` pass at 9045f41 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/summary-records-api/20261011T082129Z)
## Gaps
- **Live provider run (Validation 3): not done.** At 08:33Z every local provider failed. Gemini's main key is out of credit (402) and the spare is at its spending cap (429), as tracked in #297. Claude got a 400 because `.env.local` lacks `ANTHROPIC_WORKSPACE_ID`. Whether a real model obeys the gallery-card rule is untested.
- **e2e prompts are stubbed:** the e2e run checks stored cards and search hits on the real server. The prompt text itself is checked by unit tests, because the stub doesn't expose prompts.
