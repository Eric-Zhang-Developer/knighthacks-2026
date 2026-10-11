## What shipped
The shared AI client takes one PNG or JPEG (signature-checked, 1 byte to 2 MiB) with a prompt and sends the same
bytes to Claude or Gemini; `transcribeImage` returns the brief's text, its legibility and every uncertain span, and
throws a safe IMAGE_UNREADABLE / IMAGE_UNSUPPORTED / INVALID_IMAGE instead of guessing or answering from text alone.

## Where it lives
`lib/ai/image.ts`, `lib/ai/generate.ts`, `tests/ai-image-input/`, `tests/e2e/ai-image-input/`.

## How to check it
verify: `node scripts/verify.mjs ai-image-input /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/ai-image-input/20261011T054615Z` FAIL (exit 1) at 6a243bc: Gemini (gemini-3.8-flash) read the synthetic brief in full in 3.9 s; Anthropic (claude-haiku-5-5) is not verified, its key needs a workspace (#61) and fails text calls the same way.

## Gaps
Claude image input is untested live until #61 is fixed (unit tests cover its request shape). No route or UI uses it
yet: a later feature uploads the image and asks the person to confirm the transcript.
