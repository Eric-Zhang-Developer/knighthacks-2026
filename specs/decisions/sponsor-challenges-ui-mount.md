# Sponsor challenges UI: where it mounts

Context: the spec said to mount the section "through the existing `components/rubric/index.tsx` wrapper" in Decide
and not to edit the page. No such wrapper exists: the rubric overlay is `components/snapshot/Rubric.tsx`, rendered
inside the snapshot panel (decision-snapshot-ui's files), and Decide's panels are listed in `app/page.tsx`.

Options: A) add `<SponsorChallenges />` to Decide in `app/page.tsx` (one import, one line); B) render it from inside
the snapshot panel, editing another feature's component; C) create `components/rubric/index.tsx`, which nothing would
render without A anyway.

Choice: A. experience-shell, which owned `app/page.tsx`, is done, so the path is free; this spec takes it in `owns`
while in flight. No shell file changes, and the rubric overlay is untouched.

How to undo: remove the import and the `<SponsorChallenges />` line from `app/page.tsx`.
