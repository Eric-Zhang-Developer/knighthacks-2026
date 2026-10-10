# AI client contract and verification

`generate({prompt, schema})` returns the schema-parsed value. `prompt` is a string
or `{text, stubKey?}`. Catch `AiError` and display its safe `message`; `code` is
NOT_CONFIGURED, PROVIDER_ERROR, INVALID_OUTPUT, INVALID_SCHEMA or STUB_UNAVAILABLE.
No provider error cause, prompt, credentials or raw response is retained.
The configured model is only GEMINI_MODEL. Provider attempts have a 30-second
HTTP timeout and no SDK retries; malformed JSON/schema output gets one retry.

AI_STUB_DIR works only with NODE_ENV=test and VERCEL absent/empty. Stub keys are
simple basenames, and realpath containment rejects traversal/symlink escape.
Fixture JSON passes the same schema parsing. Fixture mode is never a live claim.
The verifier chooses live mode when GEMINI_API_KEY is present; otherwise it uses
the committed smoke fixture, saving mode/model/data in the evidence attachment.

Playwright runs an isolated Node child with the actual owned source transpiled by
the existing TypeScript compiler. Only the Next build-time server-only marker is
substituted; the app has no fixture endpoint. This exercises server logic rather
than a browser flow. Unit checks confirm the installed Next compiler maps that
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

