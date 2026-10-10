## What shipped
The idea card in the right column: type (or speak into) an idea, press Interpret to preview the six fields as editable inputs, then Save. The saved idea becomes a cyan star among its five real neighbors, which are highlighted amber. If interpretation fails, the typed text stays in Description and the fields can be filled by hand. A retried Save reuses one Idempotency-Key per preview. On reload, `GET /api/ideas` brings the star back at the same position.
## Where it lives
`components/idea/` (index.tsx, fields.ts, idea.module.css), `tests/idea-create-ui/`, `tests/e2e/idea-create-ui/` (fixture for AI_STUB_DIR)
## How to check it
verify: `node scripts/verify.mjs idea-create-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/idea-create-ui/20261010T134243Z` pass at a7593bd (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/idea-create-ui/20261010T134243Z)
Run with `DATABASE_URL` set to the Neon test branch and `AI_STUB_DIR=tests/e2e/idea-create-ui/fixtures AI_STUB_ALLOW=1`. Gemini is stubbed; the HF embedding and Neon placement are real. The star check counts cyan pixels on the canvas and was confirmed to fail when the star isn't added.
## Gaps
- Not run against live Gemini: interpretation is stubbed in the e2e, and live Claude/Gemini configuration is tracked in #61.
- Only the latest idea is shown as a card. Earlier saved ideas still appear as stars, but there's no picker until idea-revisions-ui and branches-ui.
- `galaxy` and `bootstrap` e2e fail on main since #108 (two `role=status` elements). It's not caused by this PR; the fix is a separate PR.
