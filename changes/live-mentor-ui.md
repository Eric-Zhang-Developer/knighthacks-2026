## What shipped
Recent-news source cards, guarded tool responses, and pending-tool cancellation when the selected idea changes.
## Where it lives
components/mentor/{Live,NewsCards,index,protocol}; tests/live-mentor-ui.
## How to check it
27 UI unit tests and provider readback pass; TypeScript and focused ESLint pass. The UI owner previously reported
the full unit suite at 584 passed and two skipped. `not verified`: the release verifier was not rerun locally
because this coordinated pass intentionally avoided another memory-heavy build. API companion #453 supplies
verified seven-day Gemini news.
## Gaps
The human accepted this change for merge; that did not exercise voice naturalness or latency. Supplemental
dev-browser run: 2/4 pass; phone navigation was blocked by the development overlay and the mic-denial test saw a
disabled startup button. Full browser, real-audio and end-to-end decision/share acceptance remain pending.
