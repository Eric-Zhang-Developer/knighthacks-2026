# Indexed batches and local resumption

Context: classifying 8,409 full descriptions is a paid offline operation that can be interrupted.
Options: repeat the whole run or retain validated batch results; positional output or explicit input indices.
Choice: content-addressed ignored caches, explicit index bijections and atomic replacement. No database writes,
new SDK, provider routing or frontend changes. Reuse the existing pinned psycopg dependency.
Invalid batches retry once and remain unknown; request/authentication/model configuration errors stop the run
after one retry. The initial batch validates configuration before scheduling the remainder.
First assumption: the new TextResponseFormat accepted a MIME string; it requires an enum (HTTP 400).
Second assumption: explicit array/index bounds were accepted; both response-format APIs rejected the full
bounded schema, while a minimal schema succeeded. The unbounded full schema was accepted but timed out at 90s.
Use the established responseMimeType/responseJsonSchema fields used by the app, omit wire cardinality bounds,
and retain exact length/index checks locally. Gemini 3 uses LOW thinking for this finite classification task;
earlier model IDs retain their defaults. This changes neither validation nor the source text supplied.
Reference: https://ai.google.dev/api/generate-content (GenerationConfig and ThinkingConfig).
Undo: remove the owned classifier/output and cache; the stored corpus is unchanged.
