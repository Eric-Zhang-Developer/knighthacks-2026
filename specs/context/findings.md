# Plan versus repository: 2026-10-10 sponsor planning audit

Worker: kiro-agent-1. Baseline `origin/main` **0930b42**; source of truth is canonical specs, milestone order and
`changes/`, supplemented by inspected code and current GitHub claims. The V3 catalog explains intent; omitted V3
features are not automatically release requirements. Main CI was green at this baseline. Audit used two GPT-6 Astra
subagents with read-only roles; no provider calls, production changes or frontend implementation were part of it.

## Historical baseline: what existed at 0930b42

| Area | Repository evidence | Remaining work / owner |
| --- | --- | --- |
| Core explore/decide flow | Completion notes for galaxy/search/drawer, guest sessions, ideas, evidence, revisions, challenge, branches, compare, private votes, snapshots and sharing | Merged does not mean production-verified; see demo/release gaps below. Do not rebuild these features. |
| Sponsor overlay | `lib/rubric/`, `app/api/rubric/`, `changes/rubric-overlay-api.md`: 28 source-matched tracks, immutable overlay, separate user proof | API has fixture-backed generation with real test Neon/HF. UI is open #188, eric-frontend-agent (Claude/Mac). Live rubric generation remains unverified. |
| User-supplied sponsor challenges | Shared `AiPrompt` is text-only; current rubric uses the fixed event catalog | No image intake, transcript confirmation, custom brief assessment or defined numeric rubric estimate. This plan adds three specs, not already-working functionality. |
| Snapshot correctness | Immutable snapshot API/UI merged | #177, claimed by codex-issue-fixes-01a12697 in #181: ensure a branch has evidence before freezing it. Do not duplicate. |
| Provider reliability | Individual fixtures and a local live Gemini demo exist | #170 (kiro-agent-1) remains draft: Claude interpretation failed (#61), Gemini compare failed and replay reported `PROVIDER_ERROR` (#179). Successful unit tests do not resolve it. |
| Live verification coverage | `specs/features/live-smoke/spec.md` covers the original AI route chain | It does not cover the static rubric or new sponsor intake. New API Validation explicitly adds isolated live static-rubric and image/text assessment checks. |
| Production demo/release | `changes/demo-flow.md` records local live Gemini/two-browser acceptance | Production run, authoritative accessible release URL, `verify_release.py` and fallback receipt remain incomplete (#113/#171/#13). Production schema rollout stays with its claimed owner/human approval. |
| Voice | Push-to-talk and token path merged; text fallback works | Live spoken-input acceptance is not established by the done note. Spoken replies remain cut/unmerged and depend on credentials; do not advertise working speech from code presence alone. |
| Corpus | Fetch/embed/search and real small corpus merged | Full 8,409-record release remains unshipped/frozen in #62/#63; preserve its ownership and publication decision. |
| New second wave | #180 added combinations, change-mind and moment API/UI specs to the submission milestone | No completion notes at baseline; issues #182-187. Backend APIs are Windows work, frontend halves Claude/Mac. They are planned, not built. |
| Optional hosting/sponsors | #166 owns Vultr packaging; roadmap reserves human Figma and submission work | No provisioned Vultr HTTPS receipt yet. No GoDaddy feature spec/milestone or deployed integration evidence. Databricks and excluded sponsor integrations stay backlog. |

Historical caveats in old done notes can be obsolete; check current source/PRs before treating one as a new bug.
The demo-flow spec's old fixture-capability remark predates explicit `AI_STUB_ALLOW=1` support; its requirement for
a **live** demo remains in force. This audit does not weaken it or mark production complete.

## Added requirement and score semantics

The user requested a section for image/text sponsor briefs and an explanation of "why yes / why not" and score.
The chosen default is an **estimated rubric score**, only when the supplied rules support it, with explicit evidence
and limitations. It is not a made-up chance of winning. Existing rubric-overlay API/UI prohibitions remain intact;
the new feature's distinct schema and UI label are the only planned score surface.

An assessment must separate: eligibility conflicts; supported implementation evidence; planned intent; unknowns;
missing proof; suggested next checks. User confirmation establishes the imported text, not organizer endorsement.
No numeric scale/anchors means no score. Missing required weights/aggregation or incomplete evidence means no total. Preserve
factual dates/points from the source without inventing them. Store the precise brief and idea versions used.

## Delivery order and cross-machine handoff

1. Finish existing ownership and failures first: #181, #170/#61/#179, #188 and production acceptance coordination.
2. Windows implements `ai-image-input`, then `sponsor-challenges-api`, with bounded input, transcript confirmation,
   scoped storage, source checking, immutable results and deterministic arithmetic. Publish the response contract
   in the API decision/PR before frontend implementation. Add test tables using reviewed additive SQL only.
3. Claude/Mac finishes #188, then claims `sponsor-challenges-ui` after its API dependency merges. Own the new
   component, explicit `app/page.tsx` mount, upload/review/assessment flow, accessibility and screenshots. No Windows
   frontend edits. Existing snapshot/rubric/private-share tests must continue to pass.
4. Each claim is a draft PR with worker name; re-fetch main and read current claims before starting. Do not start
   a second implementation from this audit alone. Preserve human plan merge, CI/review gates and milestone deadlines.
5. Broader product direction lives in the roadmap's future section. No non-hackathon connector or platform rewrite
   is part of the hackathon milestone. Validate one new setting with actual user feedback before expanding.

Coordination was sent to Claude's #188 and parent issue #189. The final plan PR is the reviewable handoff; details
in chat are not a substitute for the merged specifications. Freeze and final code-push times are unchanged.

## Earlier refresh: 2026-10-10, main 93f07f5

The audit above records the earlier baseline, not current claim status. Rubric UI #188 and corpus release/publication
#62 and #191 have merged; there is no unresolved corpus claim in this refresh. Main now schedules constellation,
research and problem-evidence features. Preserve all of them and append the three sponsor features before demo-flow.
The earlier description of unclaimed second-wave work is historical and must not be used to claim another worker's task.

Experience-shell plan #222 is still open and proposes ownership of `app/page.tsx`, also named by sponsor UI.
Claude/Mac must coordinate that mount and resolve sequencing against the merged plan before implementation;
no dependency on an absent shell spec is added here. Sponsor intake belongs in the contextual decision area on
desktop and phone (the Decide destination if the shell lands). Backend feature ownership is unchanged.
This refresh claims neither production verification nor completion of sponsor intake. A person must merge this plan.

## Current refresh: 2026-10-10, main e773216

The historical table is not current pick order. The full 8,409-project corpus, rubric UI, second/third-wave features,
workspace restore, challenge resume and rehearsal are merged. Corpus classification is Windows PR #285; Mac owns
interview API #290, build-plan API #292 and galaxy category UI #289. This plan preserves every current milestone
entry and appends sponsor intake after the newly accepted flow features, before the optional Vultr deployment.
Image ownership is narrowed to `lib/ai/generate.ts` and a new image helper, avoiding the grounded-search collision.
The page mount still needs the person's sequencing decision against open experience-shell plan #222; this refresh
does not claim the overlap resolved. Do not implement sponsor intake before the plan is accepted.
Current release blockers include main's font build (#226), live comparison (#179) and Anthropic configuration (#61).
