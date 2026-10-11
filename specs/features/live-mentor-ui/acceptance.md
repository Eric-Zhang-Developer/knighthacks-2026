# Conversation-first acceptance: evidence, not completion by plan

Baseline inspected: main `5740654f9dccb88502364514880eaf5bdfa1d222`; backend draft #355
at `9df58dffeebc22309bb79666c52c98adb87d3e30`. This is source/receipt review, not a new live browser run.
No item below becomes complete merely because this plan merges or a mocked test passes.

| User requirement | Observed gap | Required implementation/acceptance evidence |
| --- | --- | --- |
| Open on map, click circular bottom-center bubble | page mounts Voice directly; Voice is a Hold to talk dictation bar | Desktop and 390px recording: map first, bubble opens conversation, no permission before intent |
| Real two-way ElevenLabs mentor | voice/index.tsx uses ScribeEngine and appendUtterance; no mentor UI mounted | Actual private-agent multi-turn audio, interruption and correction; record effective model/voice and timing |
| Conversation rather than a side-panel form | idea/index.tsx maps FIELDS into a form; Interview renders multiple answer inputs | Typed and spoken proposal/refinement/save without entering a form; optional Edit details only |
| Bubble everywhere | phone page CSS shows composer only in Explore/Talk | Visit all five destinations with the same active session and draft; bubble and End remain usable |
| Constructive challenge, not automatic praise | draft mentor prompt covers context/evidence but lacks explicit anti-praise and failure/success questioning | Updated effective agent prompt plus human transcript showing relevant risk, reason and follow-up; no fabricated claims |
| User decides when to explore/invite | existing navigation exists, but no conversation actions integrate it | After useful exchange user chooses Explore or teammate controls; no forced move, invitation or save |
| Dark restrained glass interface | dark Material tokens exist; current placement and density are unchanged | Screenshots and measured contrast on desktop/phone; solid/reduced-motion fallbacks; no control overlap |
| Actually usable through completion | no mentor end-to-end receipt; #355 unmerged and #357 open | Fresh workspace: conversation -> real evidence -> confirmed idea -> decision -> share, plus denied-mic text journey |

## Release gates

- #365 human-reviewed plan merge precedes frontend implementation under the new ownership/scope.
- live-mentor-api must satisfy its dependency/acceptance contract; do not relabel dictation as a substitute.
- #357 records missing provider conversational-agent permission and local agent ID. Treat as unresolved until
  a sanitized effective-configuration/token/human-audio receipt proves otherwise. Do not log credentials.
- Keep test/provider-mocked, real-provider, deployed and human-tried receipts distinct. UI test success cannot
  prove the provider was configured or that conversation sounds natural.
- Update obsolete placement assertions only with replacement behavior assertions and a stated reason. Never
  remove auth, explicit-confirmation, source grounding, cancellation, quota or accessibility checks to pass.
- Report remaining gaps explicitly; no changes/live-mentor-ui.md completion claim before required validation.

## Efficient execution

One frontend owner, this Codex chat; no duplicate Claude lane. Reuse installed SDK and existing domain routes.
Use focused deterministic tests during edits; run the full required suite on the integrated candidate. No
provider retries while permission/configuration is blocked. No extra worker beyond the local three-worker cap.
Small bounded styling/test tasks may use a lower-cost model; authentication/session race review requires the
stronger reviewer. Neither model choice nor delegation replaces independent evidence of the user's journey.

## October 11 evidence visibility correction

Retrieved conversation sources previously lived inside the optional, usually closed transcript. They now
render in the idea/evidence panel independently, with excerpts, source links and project inspection. The
explicit phrase "show related projects" opens already-retrieved sources without starting another search.
An empty result is not presented as proof of originality. Source-card rendering, unsafe-link rejection and
bounded command recognition have unit coverage; the full suite passes 545 tests with two skipped.
Type checking and lint pass. These are automated/source receipts, not a new phone or audio verification.
Fresh browser automation is blocked by the session's browser access policy; no alternate browser workaround
was used. Human basic live audio was reported working, but the user explicitly has not tried the remaining
real-evidence -> proposal -> explicit confirmed-save flow. Required live/phone and decision/share acceptance
remain open; no completion note or production readiness is claimed.

## Desktop screenshot follow-up

The user's production `?layout=nebula` screenshot still shows the separate square/red theme and old dictation
bar, not this unmerged mentor shell. Mac theme owner received the concrete feedback on PR #432. In this UI
branch, destination-scoped panel visibility now applies to desktop as well as phone: Explore has no permanent
idea rail, a selected project still opens inspection, and Idea/Decide/Plan no longer stack together. The existing
mentor mount is unchanged. Added 390px/1440px browser assertions for destination isolation, bubble visibility
and horizontal overflow. These new browser assertions are not run here because browser access is policy-blocked;
Mac visual verification and production integration remain required. This is not a whole-app redesign completion.

## Plan 443 saved-idea controls (October 11)

Added a compact saved-idea picker, Add idea, exact-title deletion review and bounded named voice intents.
Selection clears conversation evidence and pending save confirmations; late initial lists/interpretations and
save receipts cannot replace a newer selection. Optional typing and the persistent voice bubble are unchanged.
Deletion is intentionally disabled in this feature branch until API #448 is integrated and validated; there is
no claim that its button deletes here. The backend owner reported a dedicated TEST_DATABASE_URL receipt for
19280d6 (targeted real-DB deletion test passed), but the full production-build verifier remains blocked.
Type checking, scoped lint and 32 mentor unit tests pass. Added 390px/1440px selector/review/cancel/reload and
late-list browser assertions; these remain unrun here under the existing browser access restriction.
Live.tsx selection invalidation is coordinated with the mentor-quality owner, not duplicated in this patch.
After repairing a missing local pinned dependency, the full unit suite passed 584 tests (two skipped).
The production build passed; full lint and type checking are also required on the integration candidate.
Full deletion UI acceptance (selected/unselected/last, failure and real voice), visual QA, and the previously
outstanding real evidence -> confirmed save -> decision/share journey still block feature completion.

Integration-only follow-up: this branch includes API448 at19280d6 and enables the named delete button for
local testing against the dedicated TEST database. Type checking, scoped lint and60 combined mentor/idea
unit tests pass. Selection also clears news cards, with live tool invalidation from mentor-quality454.
This is not production approval or browser/voice acceptance; the UI feature branch keeps deletion disabled.
