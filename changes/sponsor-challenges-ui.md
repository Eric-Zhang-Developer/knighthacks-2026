## What shipped
A "Sponsor challenges" section in Decide. Paste a brief and/or choose or drop one PNG or JPEG (a local preview, revoked when replaced). Review and edit the transcript, the uncertain lines and the requirement quotes (misquotes flagged in words), then confirm. Assess a saved idea with optional evidence notes and see eligibility, counts, why it fits or doesn't, what's still unknown, per-requirement status, basis and missing proof, each with its claim badge and expandable source quotes, and the rubric estimate or the reason there is none. Saved briefs reopen with their assessments; also reassess, correct the brief (a new revision; older ones are marked), retry a failed assessment, and delete in two steps.
## Where it lives
`components/sponsor-challenges/` (mounted in `app/page.tsx` Decide; `specs/decisions/sponsor-challenges-ui-mount.md`), `tests/e2e/sponsor-challenges-ui/challenges.spec.ts`.
## How to check it
verify: `node scripts/verify.mjs sponsor-challenges-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/sponsor-challenges-ui/20261011T130259Z` pass at b5c3054, run with stubbed models (`AI_STUB_ALLOW=1 AI_STUB_DIR=<abs dir>`) against the test Neon branch.
## Gaps
- Production: `GET /api/sponsor-challenges` answers 200 with a guest workspace (checked 2026-10-11), so the tables exist there, but import and assessment were not run in production, and no live model was run anywhere (keys: #408, #61). If a call fails, the section says so with a retry.
- The rubric found in a brief can be included or excluded, but not edited field by field.
- Validation 4's rubric-overlay-ui and decision-snapshot-ui acceptance fail at their first step on the hidden `[data-workspace-id]` badge, the stale pre-#369 locator in #489, before reaching Decide; not changed here.
- The image preview lasts only while the brief is open; a reopened brief shows its transcript, not the image.
