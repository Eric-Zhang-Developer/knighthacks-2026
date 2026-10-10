## What shipped
Push-to-talk voice bar: hold (pointer, Space or Enter) to speak, see the partial transcript live, release to commit the utterance into `ideaDraft`. `POST /api/voice/token` mints a single-use ElevenLabs `realtime_scribe` token; the key stays on the server. A denied mic or a provider failure shows a notice and leaves `ideaDraft` untouched; the End voice session control is always visible.
## Where it lives
`components/voice/`, `app/api/voice/token/route.ts`, `lib/voice/` (`token.ts`, `draft.ts`), `tests/voice/`, `tests/e2e/voice/`
## How to check it
verify: `node scripts/verify.mjs voice /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/voice/20261010T104020Z` pass at f4f4e18 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/voice/20261010T104020Z)
## Gaps
- Validation 1 (hold to talk, speak, text lands in `ideaDraft`) not run live: no `ELEVENLABS_API_KEY` yet (#11). The e2e test for the token's 200 path skips without the key; the unit test covers it with a mocked SDK.
- The token route has no rate limit: anyone who can reach the app can mint tokens on our ElevenLabs quota.
- Nothing shows `ideaDraft` until idea-create ships; the bar echoes the last added utterance meanwhile.
