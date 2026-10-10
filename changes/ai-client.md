## What shipped
Server-only validated JSON, bounded retry, typed errors, source-membership claim downgrades; Claude preferred with Gemini fallback. Local production verification can explicitly opt into fixtures with `AI_STUB_ALLOW=1`; Vercel always rejects fixtures.
## Where it lives
lib/ai/, tests/ai-client/, tests/e2e/ai-client/; specs/decisions/ai-client-contract.md and ai-client-local-verifier.md.
## How to check it
verify: `node scripts/verify.mjs ai-client "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\ai-client\20261010T131109Z"` pass at 77b4102 — 2 tests, including actual production Next HTTP fixture success and denial without opt-in/on Vercel. Separate live Gemini `gemini-3.8-flash` returned `{"message":"AI client verified"}` with the new local environment.
## Gaps
Claude live remains unverified: the new local key returned sanitized PROVIDER_ERROR when tested alone; #61 tracks its workspace configuration. The canonical run used fixtures; Gemini's separate live run removed the Claude key. Claims check source membership, not factual entailment. PR preview deployment is blocked by Vercel build quota (#111).
