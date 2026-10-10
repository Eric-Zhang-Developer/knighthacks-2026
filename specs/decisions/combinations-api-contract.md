# Combinations API: bounded proposals and immutable storage

POST/GET `/api/combinations/:versionId` return status 200 with the exact feature response. POST takes no body; an actually empty Node request stream is accepted. Missing session is 401, foreign/missing version or missing GET result 404, cross-origin write 403, invalid input 400, provider failure 502, unavailable source/database 503. Responses are no-store.

Generation receives only the authorized immutable idea and its first five saved neighbors, validated against that version's corpus version. Every source needs its real nonblank title, HTTP(S) URL and description/tagline/title excerpt (in that fallback order), bounded to 6000 characters. Missing source data fails recoverably rather than inventing or substituting projects. Stored results remain readable without revalidating today's corpus.

Fixed fixture key: `combinations`. Wire candidates have `{user,benefit,workflow,sourceIds,claims}`. There are at most three candidates, user <=300 characters, benefit/claim text <=1000, at most six workflow steps <=500 each, at most six additional claims. Each item is parsed independently using nullable/catch: malformed items become null and are dropped. Exactly two distinct selected-neighbor IDs are required; a third/outside source drops the candidate. Metadata is copied by the server, never accepted from the model.

Both benefit and claims pass shared checkClaims before filtering IDs. Supported text must be an exact quote in every cited selected source; foreign/nonquoting claims become unverified. `workflowIsProposal:true` is server-assigned. Prompts and a conservative explicit-assertion filter disallow claims that the combination exists/deployed or will win; natural-language paraphrases remain a model-quality limitation, not a formal semantic guarantee.

All-invalid/empty output persists `suggestions:[]`; no fictional padding or additional retry loop. Positive fixture validation separately proves a useful valid suggestion. A new immutable idea version is needed for a fresh generation; this endpoint does not silently overwrite an empty result.

`combinations.version_id` is a primary/foreign key with cascade from idea_versions. One authorized INSERT ON CONFLICT DO NOTHING freezes data and source excerpts; a fresh scoped SELECT returns a concurrent winner. Sequential repeats never call AI. Simultaneous first requests may both generate, but store one immutable winner. No version writes occur.

Root applies the additive SQL in `tests/combinations-api/test-schema.sql` only to the dedicated test branch. E2E uses real HTTP/HF/Neon plus an explicit model fixture, retains successful owner rows, deletes stranger/failed-owner exact IDs, and exclusively creates/removes its fixture. No live generation is claimed. To undo the empty-result policy, a later reviewed explicit regeneration contract would be needed.
