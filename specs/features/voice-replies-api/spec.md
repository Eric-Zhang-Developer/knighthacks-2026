---
name: Server-side text-to-speech for short replies
depends_on: [bootstrap]
owns: [app/api/speech/, tests/voice-replies-api/, tests/e2e/voice-replies-api/]
assignee: ""
---

# Voice replies (F03 voice, replies): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it stays unclaimed for 15 minutes, so the backend chain never waits on one machine.

## Plan
1. `POST /api/speech` `{"text"}` -> streamed audio from ElevenLabs text-to-speech; 400 above 200 characters; 503 `{"error"}` when the provider fails.

## Requirements
- The ElevenLabs key stays on the server; no response contains it.
- No audio is stored.

## Validation
1. `POST` a short text -> 200 audio bytes; a long text -> 400; the provider down (stubbed) -> 503.
2. `tests/e2e/voice-replies-api/` covers 1. Keep the response headers.

## Defaults
One voice, picked once and recorded in `specs/decisions/voice-replies-api-voice.md`.
