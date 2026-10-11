# First implementation preview

The human explicitly authorized merging plan #365 and implementation/preview work while the backend is
unfinished. #365 was squash-merged with its exact head after its CI passed. #369 remains a draft, not a
completed feature or production release. No production provider configuration, schema or application data was changed.

Implemented: persistent bubble, lazy-loaded ElevenLabs conversation controls, same-origin session/tool client,
typed interpretation/interview adapter, unsaved proposal with explicit idempotent save, compact Team menu,
filter disclosure, secondary map controls disclosure, removed primary explainer/dictation bar and collapsed
secondary idea panels. Search/workspace presentation paths were added to this feature's scope to implement
the human's phone screenshot feedback; their API contracts are unchanged.

Checks: TypeScript and ESLint pass; Vitest 402 passed, 2 opt-in tests skipped. Local browser at 390x844 showed
the bubble opening, real SDK Start live conversation control loading, and draft text remaining after switching
to Idea. The page no longer mounts the Scribe dictation bar. Graphify AST updated without provider calls.

Gaps: localhost workspace initialization reports unavailable, so real typed generation/save was not verified.
Hosted branch preview returned Vercel You Need Access for the signed-in browser account; protection was not
disabled. Backend #355 remains unmerged, #357 provider permissions/configuration remains a known blocker.
No actual microphone/provider session was started, no human audio acceptance, no production-build verify.py
receipt, no complete new browser regression suite, and no claim that all older placement-dependent tests pass.
Map-label collision work is not included. Do not merge/mark complete on unit tests alone.

Next: authenticate the hosted preview or configure an isolated local test workspace, then run the typed
conversation -> proposal -> explicit save -> evidence/decision/share journey. Complete dependency #355 and
actual private-agent audio/interruption validation before declaring live mentorship functional.
