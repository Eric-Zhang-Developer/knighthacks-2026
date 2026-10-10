# AI client contract and verification

`generate({prompt, schema})` returns the schema-parsed value. `prompt` is a string
or `{text, stubKey?}`. Catch `AiError` and display its safe `message`; `code` is
NOT_CONFIGURED, PROVIDER_ERROR, INVALID_OUTPUT, INVALID_SCHEMA or STUB_UNAVAILABLE.
No provider error cause, prompt, credentials or raw response is retained.
Models come from GEMINI_MODEL and ANTHROPIC_MODEL. Gemini attempts have a
30-second HTTP timeout, Claude 60 seconds; neither SDK retries. Malformed
JSON/schema output gets one retry.

AI_STUB_DIR requires NODE_ENV=test or explicit AI_STUB_ALLOW=1, with VERCEL
absent/empty in both cases. This permits opt-in local production verification;
see ai-client-local-verifier.md. Stub keys are simple basenames, and realpath
containment rejects traversal/symlink escape. Fixture JSON passes the same schema
parsing. Fixture mode is never a live claim. The provider verifier checks every
configured provider separately with the other's key removed; if neither is
configured it uses the smoke fixture, saving mode/model/data in the evidence.

Playwright runs an isolated Node child with the actual owned source transpiled by
the existing TypeScript compiler. Only the Next build-time server-only marker is
substituted; the app has no fixture endpoint. A separate regression builds a
temporary production Next app importing the unchanged server-only module and
checks fixture opt-in and denial over HTTP. Unit checks confirm the compiler maps that
marker to its client-import error module. A real negative Next 15.5.4 production
build also rejected a temporary client component importing the actual
lib/ai/generate.ts with the expected server-only diagnostic and import trace.
`checkClaims` checks cited-source membership, not whether citations prove a claim.

## Second provider (#55)
Claude (`ANTHROPIC_MODEL`) is preferred, Gemini (`GEMINI_MODEL`) is the fallback; `AI_PROVIDER=gemini` swaps them.
Only PROVIDER_ERROR (network, HTTP error, timeout, refusal) falls through; INVALID_OUTPUT does not, since it points
at the prompt or schema. Claude attempts have a 60-second timeout (thinking models run longer than Gemini Flash)
and no SDK retries. The Anthropic zod helper drops JSON Schema keywords structured outputs reject (`minLength`,
`maximum`...); zod still enforces them on the reply. Options were: Claude only (loses the Gemini prize and
redundancy), a per-call provider argument (no caller needs it yet), or this. Undo: delete the `anthropic` call in
`providers()`.

