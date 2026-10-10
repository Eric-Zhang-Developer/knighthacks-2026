---
name: Hear short spoken replies, with mute and stop-speaking always visible
depends_on: [voice, idea-create]
owns: [app/api/speech/, lib/speech/, components/speech/, tests/voice-replies/, tests/e2e/voice-replies/]
assignee: ""
---

# Voice replies (F03 voice, replies)

## Plan
1. Mount: a separate `fix: mount speech controls in the shell` PR adds `<Speech />` from
   `components/speech/index.tsx` to the voice footer in `app/page.tsx` (shared shell, owned by no feature).
2. `POST /api/speech`: ElevenLabs streaming text-to-speech for a short text; the key stays on the server.
3. When `activeIdeaVersionId` changes, speak a one-sentence read-back of the saved idea. Citations stay in the
   panels, never in speech.
4. Mute and stop-speaking always visible. Interrupting (talking, stop, or a newer turn) stops audio at once and
   drops any reply from an older turn (turn generation counter).

## Requirements
- Speech never blocks the text flow: with TTS down, the app works silently and shows a notice.
- With the microphone denied, typing an idea still saves it and the read-back still plays (mission: voice and
  text call the same server operations).
- No audio is stored.

## Validation
1. Save an idea -> a short read-back plays; press stop -> audio stops at once.
2. Save two ideas quickly -> only the newer read-back plays.
3. Deny the mic, type an idea and save -> it saves, the star appears and the read-back plays.
4. `tests/e2e/voice-replies/` covers the route (no key in the response), 2 and 3, with TTS stubbed in the test only;
   1 is a live check written in the done note.

## Defaults
One voice, picked once and recorded in `specs/decisions/voice-replies-voice.md`. Replies under 20 words.
