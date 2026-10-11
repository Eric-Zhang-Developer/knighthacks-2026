---
name: Speak an idea with push-to-talk, with text as the fallback
depends_on: [bootstrap, guest-workspace]
owns: [app/api/voice/, lib/voice/, db/schema/voice.ts, components/voice/, tests/voice/, tests/e2e/voice/]
assignee: ""
---

# Voice input (F03 voice)

Push-to-talk writes into `ideaDraft` in the shared store, so it needs only the shell, not idea-create. Spoken
replies, and the "mic denied, typing still saves an idea" check, moved to `voice-replies`, which runs after
idea-create.

## Plan
1. `POST /api/voice/token`: mint a single-use ElevenLabs realtime speech-to-text token.
2. Push-to-talk bar: partial transcript shows live; releasing commits it into `ideaDraft`.
3. Mic and end-session controls always visible.

## Requirements
- The ElevenLabs API key stays on the server.
- The partial transcript is display-only; only the released utterance reaches `ideaDraft`.
- Microphone denied or provider down -> a visible notice, and `ideaDraft` is untouched.
- No raw audio is stored.
- Token minting requires an existing workspace session and a same-origin request. Per the user's explicit
  October 11 override, the app imposes no token-issuance quota during the demo. Provider and platform controls
  remain external to this route. Missing configuration returns 503 without contacting the provider.

## Validation
1. Hold to talk, say an idea -> partial text, then it lands in `ideaDraft` (the idea input shows it once
   idea-create ships).
2. Deny the mic -> the notice shows; `ideaDraft` is unchanged.
3. `tests/e2e/voice/` covers 2 and the token route (200 with a token, and no key in the response); 1 is a live
   check written in the done note.
4. Unauthenticated requests return 401 without a mint. Repeated authenticated, same-origin requests continue
   to mint without an app-generated 429 response.

## Defaults
This existing component is push-to-talk only. The user's October 10 clarification (#345) makes live spoken
mentorship the primary experience; live-mentor-api/ui implement it separately. Do not count this transcription
feature or the cut read-back feature as conversational acceptance.
