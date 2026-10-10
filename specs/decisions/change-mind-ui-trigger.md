# change-mind-ui: listing assumptions runs when asked

**Context.** The spec's Validation says "Save an idea -> assumptions appear", but not whether the list is generated on
save or on request. **Options.** A: POST automatically for every active version. B: load a stored list on its own
(GET) and offer "List my assumptions" (POST) when there is none. **Choice.** B: each POST is a model call, and a
revision or branch makes a new version, so A would spend one call per version whether or not anyone looks. The
section still appears as soon as an idea is saved. **How to undo.** In `components/challenge/ChangeMind.tsx`, call
`fetchList("POST")` when the GET answers 404.
