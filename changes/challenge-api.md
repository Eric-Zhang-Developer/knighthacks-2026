## What shipped
Workspace-authorized three-round critic sessions, real-source quotations or named unverified tests, history-aware questions, persisted outcomes, concurrent-operation fencing and failed-round recovery; never creates idea versions.
## Where it lives
app/api/challenge/, lib/challenge/, db/schema/challenge.ts, tests/challenge-api/, tests/e2e/challenge-api/.
## How to check it
verify: `node scripts/verify.mjs challenge-api "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\challenge-api\20261010T141209Z"` pass at 4214849; real Neon/HF with test-only generation fixtures, retained sessions; 129 unit tests passed.
## Gaps
Production schema is pending (#113); no live critic-generation or user trial claimed. Failed generation/assessment consumes a round; after three slots the user explicitly starts a new session. Five-minute recovery leases are unit-checked; normal concurrency and failed-grounding recovery passed against Neon.
