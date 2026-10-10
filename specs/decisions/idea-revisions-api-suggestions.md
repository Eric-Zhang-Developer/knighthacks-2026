# Revision suggestions: what a suggestion is, and how accept and reject behave

Context: the spec gives suggestions as `{id, field, change, reason}` over "audience, workflow, constraint or interaction",
and an accept must create a version, but it doesn't say what `change` holds or how an accept finds its suggestion.

Choice (eric-claude-agent-1):
- `field` is one of the version fields `audience`, `problem`, `workflow`, `constraints` ("interaction" is how someone
  uses it, so it maps to `workflow`). `change` is that field's complete new text, so an accept is a plain field
  replacement, with no second model call to apply a diff.
- Proposals are stored in `revision_suggestions`, so `accept` takes only the id. Accepting records the new version's id
  on the suggestion in the same statement that inserts it: a retried accept returns that version (200) instead of a
  duplicate. Different suggestions on one parent insert independently, so concurrent accepts become siblings.
- Reject writes nothing (spec), so a rejected suggestion can still be accepted later. Reject only checks ownership.
- Placement is D1 (mean of the 5 cosine neighbors' stored coordinates) computed in the insert statement; with fewer than
  5 neighbors or mixed corpus versions nothing is written and the API returns 503.
- Ids from another workspace return 404, the same as missing ones.

How to undo: storing suggestions is the only schema addition; drop `revision_suggestions` and pass the suggestion body to
accept instead. Changing `change` to a diff needs a second `generate` call in accept.
