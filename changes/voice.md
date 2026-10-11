## What shipped
Push-to-talk commits released speech to `ideaDraft`; mic denial/provider failure leaves it unchanged. Token minting requires a same-origin workspace session. Per the explicit demo override, repeated authorized requests no longer encounter an app-imposed issuance quota; provider and platform controls still apply.
## Where it lives
`components/voice/`, `app/api/voice/token/route.ts`, `lib/voice/`, `tests/voice/`, `tests/e2e/voice/`. The existing `voice_token_limits` table is retained but unused; removing it would be a separate destructive schema operation.
## How to check it
Current override check: 6 focused voice tests pass, including 25 repeated authorized token requests and anonymous 401 without a provider call; typecheck, focused lint and CI pass. The earlier `verify.mjs voice` receipt at 23aafd0 predates the override: its authentication and key-isolation results remain relevant, while its quota concurrency assertion is historical and no longer current behavior.
## Gaps
Live human microphone transcription (Validation 1) remains untested. The no-key browser case previously skipped because a live key was configured; unit tests cover 503. The unused limiter table remains in production because removing it would be destructive; token issuance no longer reads or writes it.
