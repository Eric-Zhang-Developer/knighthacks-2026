# prove-it-api: a recorded result freezes the draft

**Context.** Review on #155 (kiro-agent-1): editing the hypothesis, procedure or observable after a result was
recorded kept the old result attached to a hypothesis nobody tested.
**Options.** A: reject draft edits once a result exists (409). B: reset result and note when the draft changes.
**Choice.** A. B silently throws away an outcome the user recorded, and "one experiment per assumption" would leave no
record of it. Correcting the result itself (a second result PATCH) is still allowed. The `result is null` condition is
in the edit's UPDATE, so Postgres rechecks it under the row lock: a concurrent result and edit either apply edit then
result, or refuse the edit.
**How to undo.** Drop `and e."result" is null` from the edit UPDATE in `lib/experiments/service.ts` and reset
`result`/`note` there instead.
