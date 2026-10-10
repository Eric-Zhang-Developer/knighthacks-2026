## What shipped
A "Combine ideas" panel after "How it compares". Each suggestion is titled by who it's for and joins two real neighbor projects, each opening the project drawer and linking to its source. Its benefit and source claims carry labels, and the workflow is marked as a proposal. Only the first suggestion shows until expanded, and loading and failure use `PanelState`. The result is generated once per version and read back after that.
## Where it lives
`components/evidence/` (combinations.tsx, index.tsx, evidence.module.css), `tests/e2e/combinations-ui/`
## How to check it
verify: `node scripts/verify.mjs combinations-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/combinations-ui/20261010T185707Z` pass at 30a9653 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/combinations-ui/20261010T185707Z)
Run with `DATABASE_URL` set to the Neon test branch, a fresh absolute `AI_STUB_DIR` and `AI_STUB_ALLOW=1`; the test writes the stub from the saved version's real neighbors. The two-source check was confirmed to fail when one source is hidden. neighbor-evidence-ui, strongest-alternative-ui and visual-polish e2e pass, along with 302 unit tests.
## Gaps
- Live model output wasn't run.
- The e2e aborts the evidence and alternative requests to stay on combinations; their own suites cover them.
- The empty state (no combination held up) wasn't exercised in e2e.
