## What shipped
Server-only JSON generation with bounded schema retry, sanitized typed errors, test-only fixtures, and source-membership claim downgrades. Two providers (#55): Claude preferred, Gemini fallback on provider errors or refusals; `AI_PROVIDER=gemini` swaps them.
## Where it lives
lib/ai/, tests/ai-client/, tests/e2e/ai-client/; contract in specs/decisions/ai-client-contract.md.
## How to check it
verify: `node scripts/verify.mjs ai-client /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/ai-client/20261010T105928Z` pass at 58be298 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/ai-client/20261010T105928Z) — live Gemini `gemini-3.8-flash` returned `{"message":"AI client verified"}`.
## Gaps
Claude live is unverified: the owner's key is not scoped to a workspace, so the API returns 400 until `ANTHROPIC_WORKSPACE_ID` is set or a workspace-scoped key replaces it (the verify run above blanked `ANTHROPIC_API_KEY`). Claude is covered by unit tests with a mocked SDK only. Claims check source membership, not factual entailment.
