## What shipped
Exported the existing guarded fixture reader so grounded search can share its restrictions; generation behavior is unchanged.
## Where it lives
`lib/ai/generate.ts`; `tests/ai-client/generate.test.ts`.
## How to check it
verify: `node scripts/verify.mjs ai-client /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/ai-client/20261010T175533Z` pass at 76c287b (uncommitted changes); 255 unit tests, typecheck and lint passed. Gemini `gemini-3.8-flash` returned schema-valid verification JSON; production stub opt-in/Vercel restrictions passed.
## Gaps
All-provider verification at 20261010T175314Z failed on the existing Claude PROVIDER_ERROR (#61); the passing run configured Gemini alone. Claude remains unverified; no provider or validation behavior changed.
