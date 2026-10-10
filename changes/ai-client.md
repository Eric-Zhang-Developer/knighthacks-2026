## What shipped
Server-only Gemini JSON generation with bounded schema retry, sanitized typed errors, test-only fixtures, and source-membership claim downgrades.
## Where it lives
lib/ai/, tests/ai-client/, tests/e2e/ai-client/; contract in specs/decisions/ai-client-contract.md.
## How to check it
verify: `node scripts/verify.mjs ai-client "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\ai-client\20261010T104221Z"` pass at 4c96e60 (evidence: C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\ai-client\20261010T104221Z)
## Gaps
Fixture verification only: response {"message":"AI client fixture verified"}, model null; live Gemini credentials unavailable. The production build/verifier,9 unit tests, typecheck/lint and real negative client-import build passed. Claims check source membership, not factual entailment.
