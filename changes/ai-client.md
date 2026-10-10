## What shipped
Server-only Gemini JSON generation with bounded schema retry, sanitized typed errors, test-only fixtures, and source-membership claim downgrades.
## Where it lives
lib/ai/, tests/ai-client/, tests/e2e/ai-client/; contract in specs/decisions/ai-client-contract.md.
## How to check it
verify: `node scripts/verify.mjs ai-client "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\ai-client\20261010T103448Z"` pass at 445ba0e (uncommitted changes) (evidence: C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\ai-client\20261010T103448Z)
## Gaps
Fixture verification only: response {"message":"AI client fixture verified"}, model null; live Gemini credentials unavailable. Verification temporarily applied pending Windows runner #39 and port #48 fixes, then restored them. Claims check source membership, not factual entailment.
