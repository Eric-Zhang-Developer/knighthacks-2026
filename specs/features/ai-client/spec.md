---
name: One server-side Gemini client with validated JSON output and claim labels
depends_on: [bootstrap]
owns: [lib/ai/, tests/ai-client/, tests/e2e/ai-client/]
assignee: ""
---

# AI client

Six features call Gemini (idea-create, idea-revisions, neighbor-evidence, challenge, compare, branches) and three
label claims. `lib/ai/` is in the tech-stack layout but no feature owned it, so the first caller would write its own
client and the rest would copy it.

## Plan
1. `lib/ai/generate.ts`: `generate({ prompt, schema })` calls Gemini through `@google/genai` with JSON output,
   model from `GEMINI_MODEL`, and returns the zod-parsed result. One retry when the JSON fails the schema, then a
   typed error the caller can show.
2. `lib/ai/claims.ts`: the `Claim` type (`text`, `label`: `supported` | `inferred` | `unverified`, `sourceIds`) and
   `checkClaims(claims, sourceIds)`: a `supported` claim with no sources, or with any source not in the given set,
   becomes `unverified`.
3. A test stub: when `AI_STUB_DIR` is set, `generate` returns the fixture JSON for the prompt's `stubKey` instead
   of calling Gemini. Tests and the verifier only.

## Requirements
- Server only: importing `lib/ai/` from a client component fails the build (`import "server-only"` or equivalent).
- `GEMINI_API_KEY` is read only here.
- A missing key or a provider error returns a typed error, never a thrown 500 with the key or prompt in it.
- `checkClaims` never upgrades a label; it only downgrades `supported`.

## Validation
1. `pnpm test` -> `tests/ai-client/` covers schema retry, the typed errors and `checkClaims` (a `supported` claim
   citing no source, or an unknown one, comes back `unverified`).
2. `tests/e2e/ai-client/` calls `generate` with a small fixed schema: against the live API when `GEMINI_API_KEY` is
   set (record the model ID and one response in the done note), against the stub otherwise.
3. `python3 .agents/scripts/verify.py --slug ai-client --worktree .` -> pass. Keep the response.

## Defaults
No streaming, no caching. Callers own their prompts and schemas; this feature owns only the call and the labels.
