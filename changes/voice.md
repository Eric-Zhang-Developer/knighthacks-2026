## What shipped
Push-to-talk commits released speech to `ideaDraft`; mic denial/provider failure leaves it unchanged. Token minting now requires a same-origin workspace session and an atomic Postgres reservation: 10 attempts per member per 60 seconds, then 429; database failure returns 503 without minting.
## Where it lives
`components/voice/`, `app/api/voice/token/route.ts`, `lib/voice/`, `db/schema/voice.ts`, `tests/voice/`, `tests/e2e/voice/`; reviewed additive SQL and test-database concurrency evidence: `specs/decisions/voice-schema.md`.
## How to check it
verify: `node scripts/verify.mjs voice "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\voice\20261010T182347Z"` pass at 23aafd0 (uncommitted changes: exact #206 tracing-root configuration, restored afterward); 4 passed including live ElevenLabs token/no-key-leak and anonymous 401, 1 conditional skip. Dedicated-Neon concurrency/expiry/isolation/cascade regression passed; 255 regular unit tests passed.
## Gaps
Live human microphone transcription (Validation 1) remains untested. The no-key browser case skipped because a live key was configured; unit tests cover 503. Production schema was not changed: coordinate additive table application through #113 before rollout, or token requests fail closed with 503. Earlier local startup timed out during font downloads; the passing run used isolated hoisted dependencies and five build workers without changing test timeouts/assertions.
