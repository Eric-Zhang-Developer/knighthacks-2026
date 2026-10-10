# Indexed batches and local resumption

Context: classifying8,409 full descriptions is a paid offline operation that can be interrupted.
Options: repeat the whole run or retain validated batch results; positional output or explicit input indices.
Choice: content-addressed ignored caches, explicit index bijections and atomic replacement. No database writes,
new SDK, provider routing or frontend changes. Reuse the existing pinned psycopg dependency.
Invalid batches retry once and remain unknown; request/authentication/model configuration errors stop the run
after one retry. The initial batch validates configuration before scheduling the remainder.
The Gemini REST TextResponseFormat requires the `APPLICATION_JSON` enum; a bounded preflight exposed HTTP400
for the MIME string. Corrected against https://ai.google.dev/api/generate-content#TextResponseFormat.
Undo: remove the owned classifier/output and cache; the stored corpus is unchanged.
