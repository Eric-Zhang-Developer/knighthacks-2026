---
name: Read a bounded sponsor-brief image through the existing shared AI client
depends_on: [ai-client]
owns: [lib/ai/, tests/ai-image-input/, tests/e2e/ai-image-input/]
assignee: ""
---

# Shared image input

Windows/backend. User request, 2026-10-10: accept images of sponsor challenges as well as text. This extends the
existing pinned SDK client; it adds no framework, OCR service, package or separate provider client in a route.

## Plan
1. Extend the structured `AiPrompt` with optional validated image input while preserving every text-only caller.
   Support one PNG or JPEG, at most 2 MiB of decoded bytes. Keep image bytes server-side and request-local.
2. Translate the same text/image/schema request into the pinned Gemini and Anthropic SDKs. Keep provider choice,
   fallback, typed safe errors, schema validation and retry budget centralized in `lib/ai/`.
3. Extract a transcript plus explicitly uncertain/unreadable spans. An unreadable image returns an actionable
   extraction failure or incomplete draft; never manufacture missing requirements or claim extraction is verified.

## Requirements
- Check byte limit, declared media type and file signature before any provider call; reject empty, mismatched or
  unsupported input. No SVG, GIF, PDF, archive or remote-URL fetching in this release.
- Never log, persist in fixtures/evidence, or return user-uploaded image bytes, credentials or provider error bodies.
  Synthetic non-sensitive test images and responses may be committed as fixtures. Existing fixture restrictions hold.
- Uploaded text and image contents are untrusted data, not instructions. An image cannot change the output schema,
  select a provider, invoke tools, request secrets or expand which workspace records the server supplies.
- A provider/model that cannot process the image reports a safe capability failure; it must not silently drop the
  image and return an apparently successful extraction from text alone. Document provider support actually tested.
- Preserve text-only generation behavior, source claim validation and the current timeout/retry/fallback policy.

## Validation
1. Unit tests inspect SDK requests for both providers: same image bytes/media type, accompanying text and schema;
   text-only requests remain unchanged. No new provider calls on invalid media, signature or size.
2. Exercise malformed/unreadable image output, safe provider errors and instruction-like image/text content.
3. Existing `tests/ai-client/` and its fixture acceptance still pass without weakening checks.
4. Canonical `verify.py --slug ai-image-input --worktree .` exercises extraction with explicit fixtures. Also run a
   synthetic legible image once with each configured image-capable provider, isolated so fallback cannot mask a
   failure; report provider, latency and actual result. Missing access/capability stays a documented blocker, not a pass.

## Defaults
One image per request; combine multiple screenshots by importing separate briefs later. Text remains available if
image extraction fails. A subsequent feature, not this shared client, asks the user to confirm the transcript.
