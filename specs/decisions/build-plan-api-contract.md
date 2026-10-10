# Build-plan API details

Context: the spec leaves item fields, request bounds and the exact freeze marker open. Reuse the existing workspace, AI, stored-evidence and claim helpers; no new dependency.

Choice: POST accepts hoursLeft 2–72, teamSize 1–20 (default 2), skills as up to 12 strings of at most 80 characters (default []). Bounds permit real work before the reserved final hour and bound model context. Every successful POST returns 201 and inserts a new row, even for identical inputs. GET returns the latest by created_at then id, or 404; other workspaces also get 404. Responses contain id, versionId, createdAt, the normalized inputs, and tour/cut/timeline/risks at the top level.

Tour/cut items use text, timeline items hour/goal, risks risk/countermeasure. Every item has label and sourceIds. Timeline hours are elapsed offsets, strictly increasing; the last goal is exactly `Code freeze` at most hoursLeft - 1. Invalid model output is retried once by lib/ai, then 502 with no insert. No win-probability/odds fields exist and the prompt prohibits them.

Context is only the owned version, its stored evidence cards, and user-provided plan inputs. Missing cards stay missing; planning never generates evidence or changes a saved version. A supported claim must cite known sources and quote the complete item text(s) in their stored fields/excerpts; unknown citations are removed and labels downgraded. Recommendations are inferred, unknowns unverified. Nothing changes corpus data or star positions.

Undo: revert the feature; retained rows are inert. Production schema application is coordinated separately under #113.
