## What shipped
Recent-news source cards, guarded tool responses, and pending-tool cancellation on selection changes; #480 removes internal status guidance and #484 restores saved idea details after reload.
## Where it lives
components/mentor/{Live,NewsCards,IdeaManager,index,protocol}; tests/live-mentor-ui including restore-order.test.ts.
## How to check it
TypeScript, full lint and 700 unit tests pass (two skipped). Four restoration regressions pass; independent local test-DB reload verification is recorded in PR #484 comment 6108665126. `not verified`: no repeat verify.py/browser run in this browser-restricted coordinator; the prior mic-denial receipt remains PR #454 comment 6108265346.
## Gaps
The human accepted this change for merge; real-audio naturalness, latency, the complete browser journey and end-to-end decision/share acceptance remain pending.
