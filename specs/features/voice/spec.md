---
name: Speak an idea and hear short replies, with text as the fallback
depends_on: [idea-create]
owns: [app/api/voice/, lib/voice/, components/voice/, tests/voice/, tests/e2e/voice/]
assignee: ""
---

# Voice (F03 voice)

## Plan
1. `POST /api/voice/token`: mint a single-use ElevenLabs realtime speech-to-text token.
2. Push-to-talk bar: partial transcript shows live; releasing commits it into `ideaDraft`.
3. Short spoken replies through ElevenLabs streaming TTS; mute and stop-speaking always visible.
4. Interrupting stops audio at once and drops any reply from an older turn.

## Requirements
- The ElevenLabs API key stays on the server.
- Microphone denied or provider down -> a visible notice; the text flow still works.
- No raw audio is stored.

## Validation
1. Hold to talk, say an idea -> partial text, then it lands in the idea input.
2. Deny the mic -> the notice shows and typing still saves an idea.
3. `tests/e2e/voice/` covers 2 and the token route; 1 is a live check written in the done note.

## Defaults
Push-to-talk only; hands-free mode is backlog.
