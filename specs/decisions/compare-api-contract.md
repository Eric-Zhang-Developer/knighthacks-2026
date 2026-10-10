# Qualitative comparison contract
Context: the spec paraphrases criteria but defaults to event.md; its “no number anywhere” validation coexists with UUID version IDs and hash source IDs.
Choice: use event.md names (Originality, Technical Understanding, Functionality, Design, Wow Factor), in that order. Functionality includes feasibility before the event's final code push. Return each version in request order, with a Claim reason and a nonempty uncertainty string.
No numeric JSON values, numeral-bearing prose, rating fields, totals or probability fields are accepted. Opaque version/source IDs keep their real digits. Missing cards produce inferred reasons; available cards require per-version citations. Supported text must be quoted from every cited excerpt; other reasons are inferred. This validates provenance, not semantic truth.
Options: use paraphrased names or the named rubric; choose the explicit Defaults source. Reuse saved evidence without generating or mutating cards, versions or database schema.
How to undo: change the comparison contract and its consumer together; this endpoint persists nothing.
