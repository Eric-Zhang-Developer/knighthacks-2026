# Voice and speech API contract

Worker: kiro-agent-1. One fixed voice: `JBFqnCBsd6RMkjVDRZzb`, the voice ID in
ElevenLabs' official [stream endpoint example](https://elevenlabs.io/docs/api-reference/text-to-speech/stream).
Use `eleven_flash_v2_5` for short replies, supported by the official
[streaming guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/streaming),
and `mp3_44100_128` output. These sources verify configuration, not live success
or account access to that voice. Pinned SDK 2.71.0 returns a Web ReadableStream;
its request options support abortSignal, timeoutInSeconds and maxRetries.

POST same-origin JSON `{text}` to `/api/speech`. Nonblank text must contain at most
200 Unicode code points (not UTF-16 units); no truncation. Malformed JSON, invalid
text, and envelopes over 8192 bytes return 400. Cross-origin or absent Origin returns 403.
Success streams 200 `audio/mpeg`, with no-store. Missing configuration, initial SDK
failure, first-byte stall or empty response returns 503 with a fixed safe error.
The first nonempty byte chunk is read before returning 200. No audio is persisted.

No SDK retries; 30-second provider/header timeout plus independent 30-second deadline
through body consumption. Request abort or response cancellation cancels the reader
and provider. Once headers have been sent, an upstream error/stall terminates the
stream with a sanitized error; status cannot become 503 and no JSON is appended.
This layer trusts the provider's declared MP3 format rather than decoding audio.

Tests cover Unicode bounds, malformed/oversized envelopes, errors, first-byte abort,
consumer cancellation, and fake-time first-byte/midstream stalls. E2E validation
combines real app HTTP 400 checks with isolated actual-route execution, substituting
only the SDK for 200 byte streaming and 503 outage. Saved evidence records safe headers,
status and byte count, never audio bytes. Those two cases do not verify live synthesis.

An additional opt-in test sends a short reply through the real app HTTP route. Set
`UNCHARTED_VERIFY_LIVE_SPEECH=1` and export an authorized `ELEVENLABS_API_KEY` into
the verifier process, then run the normal voice-replies-api verifier. Existing
Playwright webServer startup inherits that environment; a key only in Next's local
env file is not sufficient for the test process. Without both the explicit opt-in
and the key, the live test is clearly skipped. It checks 200, audio/mpeg, no-store,
nonempty audio and absence of the key from response headers/bytes. It saves only
sanitized status, selected headers and byte count; traces and audio persistence are
disabled. It does not assess playback or audio quality. Keep the feature draft
without a completion note until live provider success has been verified.
