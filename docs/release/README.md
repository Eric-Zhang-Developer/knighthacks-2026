# Uncharted release package

This package connects the implemented product to its release evidence and judging preparation. It does not
change canonical scope in `specs/`, authorize production operations, or certify an unverified deployment.
Prepared for #339 by kiro-agent-1 from `origin/main` **02fd1b8**, October 10, 2026. Later changes need fresh receipts.

## Product promise

Uncharted helps two hackathon teammates decide what to build before spending the event on an untested idea.
It puts an idea beside relevant real projects, exposes one assumption, preserves revisions and lets teammates
make a private choice that becomes a stable shareable decision. The map is a way to explore evidence, not a
measurement of originality or a prediction of winning.

Read [architecture](architecture.md) for how this works and [coverage](coverage.md) for what is implemented,
partial or deferred. Do not present a planned feature as a working feature.

## Current evidence and blockers

| Evidence | What it establishes | What it does not establish |
|---|---|---|
| [Demo receipt](../../changes/demo-flow.md), PR #311 | One complete local two-browser journey with real Gemini, test Neon, immutable chosen snapshot and matching phone share; 380 unit tests passed, two opt-in skips | Production success, human microphone use, ten consecutive journeys, or all AI routes |
| [Corpus receipt](../../changes/corpus-release.md) | Validated production publication of 8,409 source-backed projects, bundle `2026-10-10-8409`, five golden queries | Exhaustive Devpost coverage, a 100k corpus, or arbitrary scale/performance claims |
| [2D map receipt](../../changes/galaxy-2d.md) | Panning/zooming implementation and browser verification | Published category classifications, true 2D corpus projection, or measured 55k-star frame rate |
| [Production issue #297](https://github.com/Eric-Zhang-Developer/knighthacks-2026/issues/297) | At this audit the working spare key was missing from Production and interpretation returned 502 | Resolution merely because the local key works or CI is green |

Existing production schema health passed on an earlier commit ([#171](https://github.com/Eric-Zhang-Developer/knighthacks-2026/issues/171)); the final release still needs its own receipt.
Pending bugs include voice token protection (#219/#221), workspace initialization (#288), solo-vote guidance
(#220), and voice permission/connection feedback (#324). Owners and latest status live on GitHub, not this snapshot.

## Acceptance runbook

1. Fetch `origin/main`, check `STOP`, review current milestones and open blocker ownership. Choose a green release
   commit; do not merge past a failed CI gate. Confirm the deployed commit and the published corpus version match
   the intended release. Local tests do not grant production schema/deployment permission.
2. Use a dedicated test database. The process running verification must have `DATABASE_URL` set to the test
   branch; simply defining `TEST_DATABASE_URL` does not select it. Keep credentials in the ignored environment or
   process environment. Do not print them. Install dependencies and Chromium with `pnpm exec playwright install chromium`.
3. Remove `AI_STUB_DIR` and `AI_STUB_ALLOW` from the live-verification environment. Configure a working provider
   and embedding model. From the checkout run:

   ```sh
   python .agents/scripts/verify.py --slug demo-flow --worktree .
   ```

   Keep the printed result and masked screenshots. On Windows, `PYTHONUTF8=1` avoids console encoding errors.
   The journey uses the text fallback, two independent browser contexts, private voting and a phone-width share.
4. After the deployment owner repairs #297 and confirms readiness, run the same command with `DEMO_BASE_URL`
   set to the public deployment. This creates demo workspace data on that deployment; coordinate with its owner.
   The current Playwright configuration still starts a local build, so keep local/test credentials isolated.
   Record actual per-step timing, provider, commit and evidence path. Never save invite/share capabilities or cookies
   in public logs; the canonical demo masks them and disables tracing.
5. Complete the owned `live-smoke` feature (#170): one core demo does not exercise comparison, every research path,
   scorecard or rehearsal. Keep recorded-response tests distinct from live-provider tests.
6. Verify the final merged deployment and keep the static snapshot outside the working tree:

   ```sh
   python .agents/scripts/verify_release.py --commit <full-merged-sha>
   python .agents/scripts/demo_snapshot.py --out <private-evidence-directory>
   ```

   Use real values in place of placeholders. These use `.agents/config.toml`'s release URL. The snapshot saves
   configured pages and a manifest; it is not a complete offline copy of AI, database or authenticated workflows.
   A recording of a genuinely successful run is the separate presentation fallback.

The original plan calls for ten consecutive core journeys. At this audit only the cited single live local run is
established. Perform the planned release repetition against a stable candidate with usable provider quota, record
every result and stop to diagnose a reproducible failure. Never turn a partial run into a pass or loop blindly.

## First-time-user trial

Have two people who did not build the app use their own idea. Avoid guiding their clicks until they get stuck.
Test both microphone input on the actual demo hardware and denied-microphone/text input. Ask each person to:

- Find one relevant past project and open its source.
- Identify which recommendation is supported, inferred or unknown.
- Accept or reject one proposed change and explain why; inspect the previous version.
- Invite the other participant, vote independently, choose a version and open its share on a fresh phone browser.
- Reload the workspace and explain what they will build and what they will test next.

Record observed task completion, stalls, actual time, the source that affected the decision, and the next proposed
fix. Ask: "What did you learn that you did not already know?" and "Did this change your choice?" Do not invent
quotes, success rates or measured time savings. The result may be that the product did not help; fix that finding.

## Demonstration script

This is a rehearsal outline, not a claim that a measured duration or user outcome already exists. Choose one real
idea, run it before recording, and use the evidence the product actually returns.

| Segment | Presenter action | Evidence for the judge |
|---|---|---|
| Problem | Explain the team's uncertainty about what to build | A concrete user, task and untested assumption |
| Discover | Enter the idea; open a relevant neighbor and its source | Actual retrieval, not a generated list of invented competitors |
| Challenge | Ask one question about an assumption; inspect the supporting source | Why evidence should affect the choice, with uncertainty visible |
| Improve | Accept a useful revision and inspect its parent; branch if helpful | An inspectable change in the decision, not just different wording |
| Decide | Teammate joins in a separate browser; both vote | Hidden preferences before both vote and the selected version afterward |
| Take away | Save the decision and open its QR/share link on a phone | A stable, read-only result and an actionable next test |

Leave room for questions. Explain that embeddings rank semantic neighbors, while the displayed projection is a
navigation aid; sparse map space is not evidence of originality. Be ready to explain the actual role of each
provider and the limits of inferred scores. A saved idea description is not proof that the proposed product works.

## Submission and sponsor evidence

The [official event page](https://knight-hacks-ix.devpost.com/) lists originality, technical understanding,
functionality, design and wow as judging criteria. Its requirements say submit by **October 11, 2026, 10:00 AM EDT**
and stop GitHub commits at **11:00 AM EDT**, despite the page header showing 11:00 AM as the deadline.
The repository's stricter freeze/report/stop times remain in [milestones](../../specs/milestones.toml).

| Deliverable | Owner role | Completion evidence to attach |
|---|---|---|
| Working public deployment and final health/demo run | Deployment owner + QA | Full SHA, deployment ID, corpus version, provider/model IDs, timestamp, sanitized receipts |
| Video and representative screenshots | Human presenters | Accessible video link and actual footage, with private capabilities masked |
| Devpost team, description and public repository | Human submitter | Submission link; every team member included; correct prize selections |
| Architecture and technical explanation | Both presenters | Understand [architecture](architecture.md); explain one real tradeoff and tools used |
| Figma track, if entered | Mac/design owner + human | Actual Figma file link and image, both required by the official listing |
| Sponsor evidence | Relevant integration owner | Real deployed operation, source location, visible result and limitations; no speculative claim |
| Release fallback and recovery | Deployment/database owners | Known-good deploy ID and retained corpus manifest; tested recording/static snapshot; database restore receipt or an explicit unverified gap |

No completion links for the human deliverables were established by this audit. Fill them with real artifacts;
do not check a box on someone's behalf. The current repository README and these docs do not prove a video or
Devpost submission exists.

| Integration | Implemented role | Proof still needed for a release claim |
|---|---|---|
| Gemini | Structured idea/evidence/challenge generation; grounded research | Successful deployed run, configured model ID, source/uncertainty explanation |
| Hugging Face | BGE-M3 embeddings; repository/model research | Actual matching corpus/query model and relevance examples; use corpus evaluation receipts |
| Neon | Corpus vectors and persistent workspaces, revisions, votes and snapshots | Deployment health plus persistence/isolation demonstrated on the released build |
| ElevenLabs | Push-to-talk transcription through short-lived server-issued tokens | Live human microphone run and token-protection rollout; do not claim cut spoken replies |
| Vultr / GoDaddy | Optional deployment/domain work | Actual qualifying running deployment/domain; PR #166 alone is not proof |
| Databricks | Deferred by the current roadmap | Do not claim an integration |

Custom sponsor image/text briefs remain [plan #190](https://github.com/Eric-Zhang-Developer/knighthacks-2026/pull/190).
The fixed sponsor overlay and general idea scorecard do not implement that request or predict prize outcomes.
