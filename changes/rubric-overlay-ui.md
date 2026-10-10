## What shipped
The chosen version's fit with all 28 event tracks, below its snapshot. Each track shows "Required" (verbatim from prizes.md, or says none is stated), "The idea says" (quoted claims only) and "Might fit" (labelled speculation). General tracks are open; sponsor and MLH tracks are collapsed. A link or note can be attached as proof; it shows as the user's own, and only then does a track read as shown. The overlay is generated once per version and read back after that.
## Where it lives
`components/snapshot/` (Rubric.tsx, index.tsx, snapshot.module.css), `tests/e2e/rubric-overlay-ui/` (AI_STUB_DIR fixtures)
## How to check it
verify: `node scripts/verify.mjs rubric-overlay-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/rubric-overlay-ui/20261010T162905Z` pass at 95482f8 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/rubric-overlay-ui/20261010T162905Z)
Run with `DATABASE_URL` set to the Neon test branch and `AI_STUB_DIR=tests/e2e/rubric-overlay-ui/fixtures AI_STUB_ALLOW=1`. The claim-label check was confirmed to fail when a badge is dropped. decision-snapshot-ui and share-qr-ui e2e still pass, and the snapshot JSON is byte-identical after a proof is attached.
## Gaps
- Live model output wasn't run; the fixture covers one quoted claim, one inferred claim and one demoted claim.
- After a reload, the proof shows once the version is chosen again; the panel doesn't remember the last choice.
- The no-score check matches wording patterns only.
