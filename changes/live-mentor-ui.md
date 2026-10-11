## What shipped
Recent-news source cards, guarded tool responses, and pending-tool cancellation when the selected idea changes.
## Where it lives
components/mentor/{Live,NewsCards,index,protocol}; tests/live-mentor-ui.
## How to check it
36 UI unit tests, provider readback, TypeScript and focused ESLint pass; the prior full run was 584 passed, 2 skipped. A warm mic-denial browser rerun passed in 13 seconds (PR #454 comment 6108265346). `not verified`: no repeat local release build in this memory-bounded pass.
## Gaps
The human accepted this change for merge; real-audio naturalness, latency, the complete browser journey and end-to-end decision/share acceptance remain pending.
