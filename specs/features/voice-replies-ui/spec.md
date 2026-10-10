---
name: Hear short spoken replies, with mute and stop-speaking always visible
depends_on: [voice-replies-api, voice, idea-create-ui]
owns: [components/speech/, tests/voice-replies-ui/, tests/e2e/voice-replies-ui/]
assignee: ""
---

# Voice replies (F03 voice, replies): UI

Frontend half: Mac workers only (user decision 2026-10-10). Build against the response shape pinned in `voice-replies-api`; the routes exist once it is done. Mount: a separate `fix: mount speech controls in the shell` PR adds `<Speech />` from `components/speech/index.tsx` to the voice footer in `app/page.tsx` (owned by no feature).

## Plan
1. When `activeIdeaVersionId` changes, speak a one-sentence read-back of the saved idea. Citations stay in the panels, never in speech.
2. Mute and stop-speaking always visible. Interrupting (talking, stop, or a newer turn) stops audio at once and drops any reply from an older turn (turn generation counter).

## Requirements
- Speech never blocks the text flow: with TTS down, the app works silently and shows a notice.
- With the microphone denied, typing an idea still saves it and the read-back still plays (mission: voice and text call the same server operations).

## Validation
1. Save an idea -> a short read-back plays; press stop -> audio stops at once.
2. Save two ideas quickly -> only the newer read-back plays.
3. Deny the mic, type an idea and save -> it saves, the star appears and the read-back plays.
4. `tests/e2e/voice-replies-ui/` covers 2 and 3, with TTS stubbed in the test only; 1 is a live check written in the done note.

## Defaults
Replies under 20 words.
