## What shipped
A "Refine your idea" panel under the idea card. "Suggest revisions" lists up to three changes, each naming its field, the change and the reason. Reject removes a suggestion and nothing else. Accept creates the next version: its star moves to the new position (animated, or a jump under reduced motion), it becomes current, and its neighbors are highlighted. The revision trail ("Version 1", "Version 2 · current") previews a past version's fields without changing the current one.
## Where it lives
`components/revisions/` (index.tsx, trail.ts, revisions.module.css), `tests/idea-revisions-ui/`, `tests/e2e/idea-revisions-ui/` (AI_STUB_DIR fixtures)
## How to check it
verify: `node scripts/verify.mjs idea-revisions-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/idea-revisions-ui/20261010T141020Z` pass at e92008c (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/idea-revisions-ui/20261010T141020Z)
Run with `DATABASE_URL` set to the Neon test branch and `AI_STUB_DIR=tests/e2e/idea-revisions-ui/fixtures AI_STUB_ALLOW=1`. The e2e checks reject and accept against the real trail API, and was confirmed to fail if previewing changed the current version. 27 neighboring e2e tests pass unchanged.
## Gaps
- Suggestions are stubbed in the e2e; this hasn't been run with live Gemini (#61).
- The idea card above (idea-create-ui) still shows version 1's text after an accept; this panel shows the current version. The idea card's owner should follow `activeIdeaVersionId`.
- After an accept, the remaining suggestions are dropped; the user asks again for the new version.
