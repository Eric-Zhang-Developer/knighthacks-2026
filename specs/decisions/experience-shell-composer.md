# experience-shell: the idea textbox stays in the Idea card

Context: Plan 2 moves the draft textbox out of `components/idea/` into the composer. But idea-create-ui's suite
(`tests/e2e/idea-create-ui/current-version.spec.ts`) finds the textbox inside the "Your idea" card, and this spec's
Requirements say each panel's suite passes unchanged.

Options: A. move it and change idea-create-ui's suite; B. a second textbox in the composer bound to the same
`ideaDraft` (two fields with one job, and a duplicate accessible name); C. keep the textbox in the card.

Choice: C. The composer holds voice, which already writes `ideaDraft`; on the phone, Talk shows the composer above
the Idea card, so speaking, the words, and Interpret are on one screen.

How to undo: export the textarea from `components/idea/` in a `fix(idea-create-ui)` PR that also updates that suite,
then mount it in the composer in `app/page.tsx`.
