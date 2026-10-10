## What shipped
Authenticated six-field interpretation and immutable idea version creation with real HF embeddings, five-neighbor D1 placement, workspace-scoped reads and atomic idempotent saves.
## Where it lives
app/api/ideas/, lib/ideas/, db/schema/ideas.ts, tests/idea-create-api/, tests/e2e/idea-create-api/; boundaries in specs/decisions/idea-create-api-boundaries.md.
## How to check it
verify: `node scripts/verify.mjs idea-create-api "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\idea-create-api\20261010T132955Z"` pass at 9b710fe (generation fixture, real HF/Neon). Live Gemini `gemini-3.8-flash` + `BAAI/bge-m3` also passed at 2b95e2c in 20261010T132357Z; saved version b9fbd8d7-6a52-45be-8f0c-4bef42014b15 remains on the test branch with its response evidence. Retry races returned 200/201 and exactly one idea/version; 79 units passed after rebase.
## Gaps
Schema and persistence verified only on TEST_DATABASE_URL; production rollout is unverified. The first live interpretation returned 502 after about 30 seconds; the same prompt then succeeded and the full live rerun passed, without changing timeouts. Claude's separate provider configuration issue remains #61; no Claude acceptance claimed.
