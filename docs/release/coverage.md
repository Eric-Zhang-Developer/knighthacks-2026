# Original feature coverage

Audit baseline: `origin/main` **02fd1b8**, October 10, 2026. This maps the original
[F01-F32 catalog](../UNCHARTED_V3_PLAN.md) to current implementation records. It is not a completion percentage:
API/UI splits create multiple records per original feature, and a merged record may list skipped validation.
Current [roadmap](../../specs/roadmap.md), milestones and feature specs supersede V3 scope and architecture.

"Mapped" means there is a corresponding merged implementation, not that every sentence of the broader V3
acceptance scenario has been proved. Follow the linked receipt and its Gaps section. Production acceptance for
the integrated release remains pending in the [runbook](README.md).

| ID | Original capability | Current implementation or gap |
|---|---|---|
| F01 | Explorable galaxy | [Mapped: galaxy](../../changes/galaxy.md), [new 2D map](../../changes/galaxy-2d.md); true 2D corpus layout remains pending |
| F02 | Historical reveal | [Mapped: galaxy history](../../changes/galaxy-history.md) |
| F03 | Speak an idea | [Mapped: voice](../../changes/voice.md), [idea entry](../../changes/idea-create-ui.md); human microphone acceptance and voice bug fixes remain pending |
| F04 | Idea becomes a star | [Mapped: idea API](../../changes/idea-create-api.md) and [UI](../../changes/idea-create-ui.md) |
| F05 | Neighbor evidence | [Mapped: evidence API](../../changes/neighbor-evidence-api.md) and [UI](../../changes/neighbor-evidence-ui.md) |
| F06 | Guided refinement | [Mapped: revision API](../../changes/idea-revisions-api.md) and [UI](../../changes/idea-revisions-ui.md) |
| F07 | Revision trail | [Mapped: revision UI](../../changes/idea-revisions-ui.md); broader animation details require their own acceptance evidence |
| F08 | Before-and-after comparison | No dedicated spec or shipped record; generic candidate comparison does not establish this scenario |
| F09 | Challenge my idea | [Mapped: challenge API](../../changes/challenge-api.md), [UI](../../changes/challenge-ui.md), [resume](../../changes/challenge-resume-ui.md) |
| F10 | Save, share and QR | [Mapped: share API](../../changes/share-qr-api.md), [UI](../../changes/share-qr-ui.md), [workspace restore](../../changes/workspace-restore-ui.md); initialization bug #288 remains open |
| F11 | Rubric and sponsor overlay | [Mapped: fixed-track API](../../changes/rubric-overlay-api.md) and [UI](../../changes/rubric-overlay-ui.md); custom image/text briefs remain unimplemented plan #190 |
| F12 | Problem evidence | [Mapped: problem-evidence API](../../changes/problem-evidence-api.md) and [UI](../../changes/problem-evidence-ui.md) |
| F13 | GitHub/Hugging Face research | [Mapped: research API](../../changes/research-api.md) and [UI](../../changes/research-ui.md) |
| F14 | Product versus building block | [Mapped within research](../../changes/research-api.md), with provenance and classification |
| F15 | Team-fit profile | No dedicated spec or shipped record; idea interview/build plan do not establish stored team skills/resources influencing recommendations |
| F16 | Compare ideas | [Mapped: compare API](../../changes/compare-api.md) and [UI](../../changes/compare-ui.md); live provider-budget fix #243 and matching UI test #259 remain open |
| F17 | Core/optional/later scope selector | No dedicated spec or shipped record; a generated build plan is not a user-controlled selector propagated into the decision |
| F18 | Demo rehearsal | [Mapped: rehearsal API](../../changes/rehearsal-api.md) and [UI](../../changes/rehearsal-ui.md) |
| F19 | Search and filters | [Mapped: search](../../changes/search.md) and [event/year filters](../../changes/search-filters-ui.md); this does not establish every original filter type |
| F20 | Explain the galaxy | [Mapped: explainer](../../changes/galaxy-explainer.md) |
| F21 | Live-event layer | No dedicated spec or shipped record; current corpus publication is not a live Knight Hacks layer |
| F22 | Guide persona | No dedicated spec or shipped record; deferred tone controls |
| F23 | What would change your mind? | [Mapped: API](../../changes/change-mind-api.md) and [UI](../../changes/change-mind-ui.md) |
| F24 | Assumption constellations | [Mapped: constellation UI](../../changes/constellation-ui.md); #282 needs a reproducible failure before speculative geometry changes |
| F25 | Branching futures | [Mapped: branches API](../../changes/branches-api.md) and [UI](../../changes/branches-ui.md) |
| F26 | Strongest alternative | [Mapped: API](../../changes/strongest-alternative-api.md) and [UI](../../changes/strongest-alternative-ui.md) |
| F27 | Prove it in ten minutes | [Mapped: API](../../changes/prove-it-api.md) and [UI](../../changes/prove-it-ui.md) |
| F28 | Meaningful combinations | [Mapped: API](../../changes/combinations-api.md) and [UI](../../changes/combinations-ui.md) |
| F29 | Team convergence | [Mapped: votes API](../../changes/team-vote-api.md) and [UI](../../changes/team-vote-ui.md); solo guidance bug #220 remains open |
| F30 | Show me the moment | [Mapped: API](../../changes/moment-api.md) and [UI](../../changes/moment-ui.md) |
| F31 | Evidence updates | No dedicated spec or shipped record; stored evidence alone does not establish change notifications or revised assessments |
| F32 | Decision snapshot | [Mapped: snapshot API](../../changes/decision-snapshot-api.md) and [UI](../../changes/decision-snapshot-ui.md); chosen-version identity checked by [demo](../../changes/demo-flow.md) |

## Additional work and deliberate differences

- [Idea interview](../../changes/idea-interview-api.md), [build plans](../../changes/build-plan-api.md) and
  [idea scorecards](../../changes/idea-scorecard-api.md) were added through later specifications. Scores explain
  evidence for and against each criterion; they are not winning probabilities.
- Corpus classification, design refresh, true 2D corpus layout, era board, live-smoke and Vultr deployment lack
  merged completion records at this baseline. Their current owner/status belongs on GitHub.
- Spoken replies are explicitly cut in current milestones; do not market a complete spoken conversation.
- Databricks and the unlisted original F-IDs remain backlog under the current roadmap. A new `plan:` merge is
  required to admit implementation; this coverage document does not authorize or silently remove them.
- Custom sponsor intake and the broader beyond-hackathons direction exist in plan #190. Neither the fixed-track
  overlay nor general five-criterion scorecard completes that separate user request.

## Evidence needed before saying complete

For each claimed release feature, record the exact code SHA, actual user action, visible result, persisted result,
verification mode (fixture/local live/deployed live/human), date and sanitized evidence location. Preserve unknowns.
Check release-level performance/retrieval claims against measured receipts rather than extrapolating from a small
fixture. The original targets include recall@10 >= 0.95, responsive local neighbors, actual-demo-device frame rate,
and ten successful consecutive core journeys; this audit does not establish all of those measurements.
