# challenge-resume-ui: keeping the session when the panel's own revision changes the version

Context: the spec reads the active version's latest session whenever `activeIdeaVersionId` changes. Accepting a
revision inside the challenge also changes it, to the new version, which has no session; challenge-ui's flow (and its
e2e) continues the same session there with "Next question". Reloading would wipe the rounds mid-challenge.

Options: A. reload on every change (breaks the revise-then-continue flow); B. skip the reload once when the change is
the version this panel just moved to by accepting a revision; C. key sessions by idea instead of version (an API change).

Choice: B. Any other switch (branches, a new idea, a reload) reads that version's latest session as specified;
switching away and back reloads. Actions wait until the version's session has been read, so a late read can't undo a
session the person just started.

How to undo: drop `followed` in `components/challenge/index.tsx`.
