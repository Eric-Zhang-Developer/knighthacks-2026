# Uncharted V3: complete product and autonomous two-computer implementation plan

## 1. Mission, architecture, and success criteria

### Main goal

Build **Uncharted**, a voice-guided galaxy of hackathon projects that helps two teammates turn an initial idea into an evidence-backed decision about what to build.

The complete experience is:

**Explore → describe an idea → investigate alternatives → challenge assumptions → revise and branch → compare with a teammate → choose → rehearse → share.**

Implement **all 32 features** described below. They should feel like one product with shared information, rather than separate tools placed beside a galaxy.

The development system must let:

- **Windows run GPT-6 Astra** for backend, data, contracts, infrastructure, and correctness.
- **Mac run Claude Opus 5.5 through agent-brigade** for frontend, visualization, interaction, and presentation.
- Both computers work continuously from the same specifications.
- Every change arrive through a PR.
- The opposite model independently review each implementation.
- Passing PRs merge and deploy automatically.
- Failed tasks recover through bounded attempts without repeatedly doing the same work.
- Every feature have one active owner.
- Phase completion automatically unlock the next phase.

This division is a deliberate organizational choice. It does not depend on an unsupported claim that one model universally outperforms the other at frontend or backend work. Both are capable coding models; continuity of ownership and independent review are the advantages. [GPT-6 Astra documentation](https://developers.openai.com/api/docs/models/gpt-6-astra), [Claude Opus 5.5 documentation](https://platform.claude.com/docs/en/release-notes/system-prompts/claude-opus-5-5)

### Decisions already fixed

| Decision | Choice |
|---|---|
| Product scope | Every feature in this plan |
| Execution | Continuous, automatic progression through verified specifications |
| Computers | Native Windows for Astra; macOS for Opus |
| Development workflow | agent-brigade on both checkouts; global coordination runs on Mac |
| PR policy | Independent review followed by automatic merge |
| Financial limit | No project-wide spending cap |
| Corpus goal | Largest permitted, successfully acquired and validated corpus before release cutoff |
| User access | Guest session with a private teammate invite |
| Primary award objective | Best Overall; support Best AI and relevant sponsor entries |
| Infrastructure | Vultr hosting, Neon application database, Hugging Face embeddings, ElevenLabs speech, Gemini generation |
| Debate integration | A bounded “Challenge my idea” mode within Uncharted |
| Repository | [Eric-Zhang-Developer/knighthacks-2026](https://github.com/Eric-Zhang-Developer/knighthacks-2026); all product changes through pull requests |

There is no existing application in the inspected workspace. Treat this as a new implementation.

**Continuous execution does not mean bypassing failed checks or continuing past the event’s code freeze.** A blocked feature remains incomplete while independent work continues. Do not silently remove features or claim that a partially implemented feature is finished.

### Product structure

Use four primary modes over a persistent galaxy:

| Mode | Purpose | Main interface |
|---|---|---|
| **Explore** | Understand existing projects | Galaxy, search, filters, timeline, project drawer |
| **Shape** | Develop an idea | Editable idea card, related projects, evidence, revision branches |
| **Challenge** | Examine weak assumptions | Selected critic, one question, evidence, proposed test |
| **Decide** | Reach agreement and prepare to present | Comparison, private votes, decision snapshot, rehearsal, share |

The desktop layout uses:

- Galaxy as the central canvas.
- Search and filters along the top.
- Idea and evidence drawer on the right.
- Voice controls and transcript along the bottom.
- Revision trail visible when an idea is selected.
- Contextual actions instead of a permanent wall of feature buttons.

Mobile opens with the idea and evidence cards. The map is an optional secondary view.

### Fixed technical stack

| Subsystem | Implementation |
|---|---|
| Web application | React, TypeScript, Vite |
| Galaxy | Three.js through React Three Fiber; GPU point buffers |
| Interface primitives | Accessible headless components, shared design tokens, restrained motion |
| Browser data | TanStack Query for server state; small local store for camera, selection, and transient interaction |
| Application API | TypeScript with Hono, Zod contracts, Drizzle |
| Application persistence | Neon Postgres |
| Product-agent execution | One self-hosted eve runtime |
| Numerical and corpus service | Python 3.11, FastAPI, PyTorch, FlagEmbedding, Faiss, UMAP |
| Embedding model | `BAAI/bge-m3`, dense vectors, pinned model revision |
| Generative model | Gemini `gemini-3.8-flash` through the Google AI SDK provider |
| Speech recognition | ElevenLabs Scribe realtime |
| Speech output | ElevenLabs streaming TTS |
| Infrastructure | Vultr Linux hosts, Docker Compose, Caddy HTTPS proxy |
| Corpus artifacts | Immutable versioned bundles in object storage, cached on the analytics host |
| CI | GitHub Actions |
| Browser verification | Playwright |
| Python verification | pytest |
| TypeScript verification | Typecheck, lint, unit/integration tests |

BGE-M3 supports multilingual input, 1,024-dimensional embeddings, and longer text than the small baseline previously discussed. Use its dense output initially; do not simultaneously implement every retrieval mode it offers. [Model documentation](https://huggingface.co/BAAI/bge-m3)

**Separate responsibilities inside the runtime:**

- The **application API owns authoritative business state**.
- **eve owns resumable execution** of bounded product workflows.
- **Python owns embeddings, retrieval, projection, and corpus processing**.
- **ElevenLabs handles speech**, not a second independent reasoning system.
- **Gemini generates interpretations, comparisons, challenges, and explanations** using typed tools and evidence.

Self-hosted eve requires persistent workflow storage and appropriate proxy routes. Run one instance with its local workflow world; do not assume Neon makes eve’s local execution state shared. [Self-hosting documentation](https://eve.dev/docs/guides/deployment/self-hosting)

### Main product invariants

1. Every displayed project has a source link.
2. Every saved revision is immutable.
3. Suggestions do not overwrite an accepted idea.
4. Similarity is calculated in embedding space, not from the displayed 3D coordinates.
5. Empty map space does not mean originality, usefulness, or likelihood of winning.
6. An assertion is marked supported, inferred, or unverified.
7. Existing products, research, reusable components, and ordinary workarounds are distinguished.
8. Voice and text invoke the same domain operations.
9. Private teammate votes are protected by the server.
10. A feature is complete only after its real user journey passes verification.

---

## 2. Complete feature specification

### Atlas and discovery

| ID | Feature | Required behavior | Acceptance condition |
|---|---|---|---|
| **F01** | Explorable galaxy | Zoom, pan, select projects, inspect clusters, return to selected idea; progressively load detail. | Selecting a visible project opens its correct source-backed record; navigation remains responsive. |
| **F02** | Historical reveal | Reveal projects over time in a fixed layout; provide play, pause, scrub, and speed controls. | Date filtering changes visibility without moving existing coordinates; unknown dates are identified. |
| **F19** | Search and filters | Search by meaning or text; filter by event, date, topic, technology, and source coverage. | Results and map highlights match; clearing filters restores the previous selection safely. |
| **F20** | Explain the galaxy | Explain proximity, projection limitations, cluster labels, collection coverage, and counts. | A user can understand why nearby stars are suggestions to inspect, not originality verdicts. |
| **F21** | Live-event layer | Import accessible Knight Hacks projects into the existing map; distinguish them visually. | Works against a historical event fixture and real public data when available; unavailable gallery has an honest state. |

**Execution details**

- Draw stars in shared GPU buffers; never create one React component per project.
- Use aggregate density at broad zoom levels.
- Load individual project tiles as the camera approaches.
- Keep the selected idea and its retrieved neighbors visible regardless of detail level.
- Limit labels to selected, hovered, and relevant projects.
- Provide a keyboard-accessible project list containing the same information.
- Distinguish total indexed projects from individual stars currently drawn.

### Idea creation and evolution

| ID | Feature | Required behavior | Acceptance condition |
|---|---|---|---|
| **F03** | Speak an idea | Show partial transcript; allow correction; interpret audience, problem, workflow, and constraints. | Microphone denial still permits the entire flow through text. |
| **F04** | Idea becomes a star | Place the accepted description in the current map and reveal relevant neighbors. | Refreshing preserves its saved position and corpus version. |
| **F06** | Guided refinement | Suggest specific changes to audience, workflow, constraint, or interaction, with reasons. | Accepting a suggestion creates a new version; rejecting it changes nothing. |
| **F07** | Revision trail | Preserve parent-child history and animate movement between accepted versions. | Any prior version can be selected and inspected without changing the current branch. |
| **F08** | Before-and-after comparison | Show changes in the description, retrieved alternatives, assumptions, and evidence. | The comparison identifies substantive changes rather than treating wording changes as innovation. |
| **F25** | Branching futures | Create up to three suggested directions and allow manual branches. | Branches preserve their parents and can be compared or selected independently. |
| **F28** | Meaningful combinations | Suggest a joined workflow inspired by two relevant project groups. | Each suggestion names a user, benefit, workflow, and source examples. |

**Execution details**

An idea version stores:

- Title and editable description.
- Intended user and problem.
- Proposed workflow.
- Constraints and selected features.
- Parent version and branch.
- Corpus and projection versions.
- Saved placement and retrieved neighbors.
- Evidence snapshot used for the recommendation.

A proposal is a preview. An explicit user action commits it.

When two teammates accept changes concurrently, preserve both as branches rather than overwriting one.

### Evidence and research

| ID | Feature | Required behavior | Acceptance condition |
|---|---|---|---|
| **F05** | Neighbor evidence cards | Explain overlapping features and meaningful differences with retrieved projects. | Every comparison links to an inspected source and identifies uncertainty. |
| **F12** | Problem-evidence panel | Find recent evidence about the problem and distinguish it from evidence about the proposed solution. | Publication date, event date when available, source, and relevance are visible. |
| **F13** | GitHub and Hugging Face research | Search relevant repositories, Spaces, models, and datasets. | Returned items have provenance and are never executed or installed automatically. |
| **F14** | Product versus building block | Classify results as direct alternatives, adjacent work, research, or reusable components. | A model library is not presented as proof that the product already exists. |
| **F23** | What would change your mind? | Identify the assumptions supporting a recommendation and evidence that would reverse it. | Each recommendation has at least one falsifiable condition or explicitly says evidence is insufficient. |
| **F26** | Strongest existing alternative | Compare the idea with the best retrieved product or current workaround. | Comparison covers the user’s actual task, not just feature names. |
| **F31** | Evidence updates | Show when newly discovered evidence changes an earlier recommendation. | The previous assessment remains inspectable; the change cites new evidence. |

**Execution details**

Research combines:

1. The local project corpus.
2. GitHub repository search and README inspection.
3. Hugging Face metadata and relevant model/dataset cards.
4. Gemini search grounding for problem evidence and news.

Use separate retrieval and synthesis steps. Preserve source identifiers and grounding metadata; do not convert unsupported generated text into a citation.

A source record contains its URL, title, source type, retrieval time, short supporting excerpt, and content hash.

Research completes with one of:

- Complete.
- Partial, with missing sources identified.
- Cancelled.
- Failed, with a recoverable explanation.

### Challenge and learning

| ID | Feature | Required behavior | Acceptance condition |
|---|---|---|---|
| **F09** | Challenge my idea | User, judge, or engineer perspective asks one useful question about one claim. | The round ends with revise, gather evidence, test, or a satisfactory-answer outcome. |
| **F22** | Guide persona | Neutral, encouraging, or lightly humorous tone. | Tone changes wording and voice only; it does not alter facts or retrieval. |
| **F24** | Assumption constellations | Show connected assumptions about need, data, feasibility, and differentiation. | Every node opens its evidence, uncertainty, and possible test. |
| **F27** | Prove it in ten minutes | Convert an assumption into a short practical experiment. | The test specifies a hypothesis, procedure, observable outcome, and recorded result. |
| **F18** | Demo rehearsal | Generate a short pitch and ask questions about the actual implemented project. | Planned features are not described as working; feedback references observable weaknesses. |
| **F30** | Show me the moment | Turn the idea into a three-step judge interaction. | The result identifies what the judge does, what appears, and what that demonstrates. |

**Debate behavior**

- The user chooses the perspective and tone.
- Each round addresses one claim.
- The system can acknowledge that the user answered well.
- No endless critic-versus-critic loop.
- Three rounds maximum per challenge session; the user can explicitly start another.
- Criticism must connect to an assumption, source, requirement, or test.
- The system cannot manufacture objections merely to sustain conversation.
- Revisions are proposed, never silently accepted.

### Team decisions and delivery

| ID | Feature | Required behavior | Acceptance condition |
|---|---|---|---|
| **F11** | Rubric and sponsor overlay | Separate organizer requirements, demonstrated implementation, and speculative fit. | Each sponsor claim has a requirement and a place to attach proof. |
| **F15** | Team-fit profile | Record interests, relevant skills, hardware, remaining time, and enthusiasm. | Recommendations explain how these inputs affected the comparison. |
| **F16** | Compare ideas | Compare two or three idea versions using explicit criteria. | Comparisons preserve uncertainty and avoid presenting a precise win probability. |
| **F17** | Feature scope selector | Mark proposed features core, optional, or later within the user’s idea. | Scope choices update the demo sketch and decision snapshot. |
| **F29** | Team convergence | Collect private preferences and concerns, then reveal agreement and disagreement. | Neither member can fetch the other’s unrevealed vote through the API. |
| **F32** | Decision snapshot | Save the selected idea, audience, alternatives, difference, uncertainty, and next test. | Snapshot remains stable even when the workspace later changes. |
| **F10** | Save, share, and QR | Create a revocable read-only snapshot link with a lightweight mobile page. | A fresh phone/browser opens the correct snapshot without gaining workspace access. |

### Visual and interaction direction

Use a restrained astronomical visual language:

- Near-black background, soft neutral text, limited accent colors.
- Cyan for the selected idea, violet for its revision history, amber for uncertainty, distinct green for current-event projects.
- Color is always accompanied by labels or shapes.
- Clear typography and solid readable panels over the canvas.
- Short movement transitions; reduced-motion mode removes camera flight and trails.
- No continuous camera movement while someone is reading or speaking.
- No decorative 3D controls that obscure evidence.
- Loading, empty, partial, failed, and offline states receive the same design attention as success states.

Create Figma frames for Explore, Shape, Challenge, Decide, and mobile sharing. Keep the implemented interface aligned with them.

---

## 3. Data, APIs, product intelligence, and deployment

### Corpus acquisition and release pipeline

Run ingestion alongside product development.

**Pipeline**

`Discover → fetch → parse → deduplicate → validate → embed → index → project → tile → publish`

1. Maintain a finite manifest of approved sources and discovered project URLs.
2. Prefer permitted bulk datasets or exports where available.
3. Fetch public pages with pacing, checkpointing, and bounded retries.
4. Preserve canonical URLs, event memberships, timestamps, technologies, language, and source provenance.
5. Deduplicate canonical projects while retaining multiple event memberships.
6. Preserve date meaning: submission, creation, update, or unknown.
7. Reject unusable records from indexing while retaining rejection counts.
8. Normalize relevant content without letting repeated boilerplate dominate it.
9. Produce dense BGE-M3 embeddings using a pinned preprocessing version.
10. Build the high-dimensional search index and spatial display artifacts.
11. Validate the entire bundle.
12. Publish it atomically.

Do not run an unbounded crawler. A run ends when its frontier is exhausted, its deadline is reached, access conditions require stopping, pagination repeats without progress, or retries are exhausted.

Expose separate counts for discovered, fetched, parsed, deduplicated, indexed, and displayed records. “Maximum available” is an acquisition objective, not a promise of a particular count.

### Retrieval and projection

**Retrieval**

- Normalize embeddings.
- Use Faiss HNSW with inner-product similarity.
- Initial settings: `M=32`, `efConstruction=200`, `efSearch=128`.
- Retrieve a candidate pool, apply filters and tombstones, and recompute exact cosine scores within that pool.
- Maintain exact retrieval as the evaluation reference.
- If filtered results are insufficient, expand the candidate pool within a fixed limit.
- Do not calculate relevance from 3D distance.

At 500,000 projects, 1,024-dimensional float32 embeddings alone occupy about **2.05 GB**. Plan host memory for the index, model, metadata, processing buffers, and release swaps as well.

**Projection**

- Use a disposable 500-project map during the first integration test.
- Fit the first production UMAP on a seeded reference sample of up to 20,000 projects, stratified across available events and dates.
- Select the reference once 20,000 valid projects are available or the initial acquisition window ends.
- Freeze that projector for the release.
- Transform subsequent corpus records and user ideas into the frozen map.
- Save coordinates rather than recalculating them on refresh.
- Flag unreliable placement when an input is far from the reference distribution.
- Preserve prior bundles for existing sessions and share links.

A release bundle contains metadata, vectors, index, projector, coordinates, spatial tiles, date masks, manifest, model revisions, and checksums.

### Application state and contracts

Use Neon for authoritative application data. Corpus bundles remain immutable files; user data does not go into the corpus index.

Core entities:

| Entity | Purpose |
|---|---|
| Workspace and Member | Guest ownership and two-person collaboration |
| TeamProfile | Skills, interests, resources, and constraints |
| Idea and IdeaVersion | Immutable descriptions and branches |
| Placement | Saved coordinates, neighbors, and corpus version |
| EvidenceSource and Claim | Provenance and supported/inferred/unverified assertions |
| ResearchRun | Workflow status and evidence snapshot |
| ChallengeSession and Turn | Critique, answer, and outcome |
| Assumption and Experiment | Uncertainty and recorded tests |
| Comparison and Vote | Candidate evaluation and private team preferences |
| DecisionSnapshot | Stable selected output |
| Share | Revocable public read capability |
| CorpusRelease | Active and historical bundle identifiers |
| SponsorRequirement | Versioned organizer requirements and attached proof |

Use UUID identifiers, UTC timestamps, explicit versions, and idempotency keys for state-changing operations.

### Public API surface

The application API exposes:

| API group | Operations |
|---|---|
| Guest/workspace | Create session, read workspace, clear workspace, create/redeem teammate invite |
| Corpus | Manifest, search, project details, tiles, filters, event coverage |
| Ideas | Interpret, create, read versions, propose revision, accept revision, branch |
| Evidence | Start research, read results, inspect sources, refresh evidence |
| Challenges | Start session, ask question, submit answer, finish round |
| Assumptions | List/edit assumptions, create experiment, record outcome |
| Decisions | Compare candidates, submit private vote, reveal, choose version |
| Presentation | Demo sketch, rehearsal, decision snapshot |
| Sharing | Create, read, revoke share |
| Voice | Issue short-lived speech token, stream authorized speech output |
| Events | Stream workspace changes and workflow progress |

All asynchronous responses carry workspace, run, idea-version, and generation identifiers.

Use server-sent events with resumable event IDs for progress. Persist accepted state before emitting a “saved” event.

Contract rules:

- Zod schemas are the source of truth for the public application API.
- Export OpenAPI and generated TypeScript clients.
- Python service interfaces have matching contract fixtures.
- Frontend developers consume generated clients.
- Contract changes are additive within this release.
- Shared contract files have one owner.
- A version mismatch produces an explicit conflict; it never silently overwrites state.

### Bounded product workflows

Use eve to execute a small number of named workflows:

1. Interpret and place.
2. Research.
3. Propose revisions.
4. Challenge an assumption.
5. Compare candidates.
6. Generate a demo or decision artifact.

Tools invoke typed application operations. Do not expose shell execution, arbitrary code execution, or autonomous publishing to the product agent.

Defaults:

- At most two research rounds.
- At most six external search queries per research run.
- At most twelve retained evidence sources per run.
- At most three parallel external calls.
- One transient retry per provider operation.
- Explicit timeouts and cancellation.
- One state-changing reasoning run per workspace; replace or cancel it deliberately.
- Cached completed research can be reused when its input and evidence versions match.

No financial cap is imposed. Limits on loops, concurrency, and retries remain because they protect responsiveness and prevent circular work.

Use Gemini low thinking for interpretation and short interactive suggestions; medium for evidence synthesis. Pin the configured model ID and record it with each run. [Gemini model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)

### Voice implementation

Use direct ElevenLabs speech recognition and TTS around the same application workflow used by text.

- Server issues a single-use speech token.
- Partial transcription is display-only.
- Explicit finish-turn or validated voice activity detection commits the utterance.
- The user can correct the interpretation before saving it.
- Spoken answers are short; citations remain in the visual evidence panel.
- Push-to-talk is the dependable default; hands-free mode is also available.
- Microphone, mute, stop-speaking, and end-session controls remain visible.
- No raw audio retention by default.

On interruption:

1. Stop the local audio queue immediately.
2. Increment the active turn generation.
3. Cancel outstanding operations where possible.
4. Discard audio and UI mutations from older generations.
5. Preserve already accepted revisions.

A provider disconnect cannot erase the idea or disable text mode. ElevenLabs documents single-use client tokens for realtime transcription. [Client streaming documentation](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/client-side-streaming)

### Guest access and sharing

- Create an opaque server-backed guest session using a secure HttpOnly cookie.
- Workspace mutations require membership.
- Teammate invitation is a single-use, expiring capability.
- Permit exactly two members for this release.
- Private votes remain inaccessible until both submit or both explicitly agree to reveal.
- Shares contain a frozen, read-only snapshot.
- Exclude private votes, raw transcripts, and private notes by default.
- Workspace owner can revoke shares.
- Clearing a workspace invalidates its active invite and share capabilities.
- Do not market guest sessions as account-backed recovery.

### Deployment topology

Use:

- **Application host:** Vultr Linux, initially 8 vCPU and 32 GB RAM.
- **Analytics/batch host:** Linux GPU instance with at least 24 GB GPU memory and 64 GB system RAM, using the selected provider’s available equivalent.
- **Neon:** production database plus isolated development/test branches.
- **Object storage:** immutable corpus bundles, release evidence, backups.
- **Caddy:** HTTPS and same-origin routing.

The analytics host prioritizes interactive embeddings over ingestion batches. Large batch jobs cannot monopolize the application API.

Run the frontend, API, and eve as separate services with explicit health checks. Keep Python private behind service authentication.

Use one eve instance and persist its workflow directory. Back up both application state and execution state. Do not add horizontal replicas to that local workflow world.

Deployment procedure:

1. Build immutable images tagged by commit.
2. Apply backward-compatible migrations.
3. Start the candidate deployment.
4. Run health and core-flow smoke tests.
5. Switch traffic only after success.
6. Retain the previous image and corpus bundle.
7. Roll back application images on regression.

Database migrations use expand-first changes. Do not automatically reverse destructive migrations.

---

## 4. Two-computer autonomous engineering system

### Roles and ownership

Use **four concurrent model sessions maximum: two per computer**. Review work takes priority over starting another builder. Coordinator and supervisor processes are deterministic programs and do not count as model sessions.

| Worker role | Model/host | Ownership |
|---|---|---|
| **Astra Platform** | GPT-6 Astra / Windows | API, contracts, Neon schema, domain rules, eve workflows, authentication, deployment and CI policy |
| **Astra Data** | GPT-6 Astra / Windows | Acquisition, embeddings, retrieval, projection, corpus release tooling, evaluation |
| **Opus Atlas** | Opus 5.5 / Mac | Galaxy renderer, camera, timeline, spatial tiles, selection, map performance |
| **Opus Experience** | Opus 5.5 / Mac | Idea/evidence panels, challenge, team decisions, voice interface, sharing, accessibility |
| **Astra Reviewer** | Fresh Astra session / Windows | Reviews Opus changes |
| **Opus Reviewer** | Fresh Opus session / Mac | Reviews Astra changes |
| **Coordinator** | Deterministic process / Mac | Assignment, task state, review dispatch, merge queue, deadlines, reporting |

A builder slot temporarily becomes a reviewer slot when needed. Do not run six unrestricted model sessions while calling the limit four.

Humans retain two useful responsibilities:

- Windows operator validates product meaning, data claims, and technical explanations.
- Mac operator validates visual coherence, interaction quality, and presentation.

These checks can happen while agents continue; they are not mandatory approval pauses between phases.

### Repository boundaries

Use separate areas for:

- Web application.
- Application API and shared domain modules.
- Product-agent workflows.
- Python analytics service.
- Shared contracts and fixtures.
- Infrastructure and CI.
- Specifications and completion evidence.

Every leaf task receives **exclusive path prefixes**. agent-brigade ownership uses prefixes, not arbitrary glob assumptions.

Shared files—including root package configuration, lockfiles, contract generation, database migrations, and workflow policy—belong to Astra Platform.

Frontend shell, global tokens, and shared UI primitives belong to Opus Experience. Atlas workers import them and request changes rather than editing them concurrently.

The two computers use independent Git clones and worktrees. **Do not synchronize source checkouts or databases through OneDrive.** Create the Windows checkout outside the current OneDrive directory.

### Install and adapt agent-brigade

Pin the audited agent-brigade revision:

`eb88a3aa2d25ab225d41c5a4961e9e9d9ad223eb`

Install its **hackathon/full** profile from that pinned revision. Preserve its spec, ownership, milestone, and completion-note conventions.

The template already supports specifications, draft PR claims, ownership checks, and verification hooks. It does not itself provide a distributed execution service or independent review guarantee. [agent-brigade](https://github.com/Eric-Zhang-Developer/agent-brigade)

Override these template defaults for Uncharted:

- Workers may not self-merge.
- The coordinator alone assigns and merges.
- Every task has an explicit worker and host.
- CI uses real project checks, not the template placeholder.
- Missing feature verification fails the completion gate.
- Ownership authority is read from the base branch.
- A feature cannot widen its own permissions.
- Disable repository-wide stale-PR cancellation by multiple watchdogs.
- Disable autonomous scope expansion.
- Automatic planning may identify dependency fixes, but may not invent new product goals.

### Specifications

Each feature is divided into independently owned backend and frontend tasks where both are necessary.

Every task spec contains:

- Feature and task ID.
- User-visible outcome.
- Assigned host and worker.
- Exclusive owned paths.
- Dependencies.
- Required contract version.
- Inputs and outputs.
- Loading, empty, partial, failed, and cancellation behavior.
- Acceptance recipe.
- Required evidence.
- Completion criteria.
- Explicit non-goals.
- Retry and escalation conditions.

A task is ready only when its dependencies have completion notes on `main`.

An API task can finish before its UI task. The **feature** cannot finish until the integrated journey passes.

### Durable coordination

Use GitHub as the shared source of truth.

The Mac coordinator maintains a dedicated `automation/state` branch containing task state. This branch never merges into application `main`.

Each task record contains:

`taskId, generation, host, worker, branch, PR, state, baseSHA, specSHA, lastProgress, review, operationId`

State transitions:

`queued → assigned → running → review → merge-ready → merged`

Side states:

`blocked, suspended, stopping, stopped`

Assignment procedure:

1. Acquire the Mac coordinator’s exclusive local lock.
2. Read current remote task state.
3. Confirm dependencies, host capacity, and nonoverlapping ownership.
4. Commit the assignment as a fast-forward update to the state branch.
5. On conflicting or ambiguous updates, reread and reconcile.
6. Launch only after assignment is confirmed remotely.

Do not add a second competing claim authority. The brigade draft PR represents the assigned work; the ledger determines who owns it.

### Worker loop

Every worker repeats:

1. Fetch current `main`, task state, and STOP status.
2. Resume its existing task and PR if present.
3. Otherwise accept the coordinator’s next assigned task.
4. Create one worktree and branch for that task generation.
5. Read root instructions, the task spec, contracts, and relevant knowledge graph.
6. Create the draft PR identifying task, worker, generation, and spec revision.
7. Implement within owned paths.
8. Run appropriate checks and feature verification.
9. Upload evidence for the current commit.
10. Request opposite-model review.
11. Repair findings within the bounded policy.
12. Await the coordinator’s merge confirmation.
13. Immediately take the next ready task.

Branch names follow:

`work/<task-id>/g<generation>`

A lost conversation does not justify creating a replacement branch. Resume the saved task from Git, specifications, and task state.

### Native Windows and Mac runners

**Windows**

- Use a Python supervisor with structured subprocess arguments and explicit working directories.
- Resolve executable paths during preflight.
- Avoid Bash syntax and shell-built command strings.
- Launch background processes hidden.
- Use Windows Job Objects with kill-on-close for agent and verification process trees.
- Hold a per-slot OS lock to prevent duplicate launches.
- Wrap brigade’s verification runner to avoid its POSIX assumptions.
- Run Python numerical production dependencies in the Linux analytics service; Windows uses fixtures and service contracts where native packages are unavailable.

**Mac**

- Use a persistent supervisor service.
- Use process groups and per-slot locks.
- Keep the coordinator separate from model conversations.
- On restart, reconcile remote state before launching or merging anything.

Both hosts:

- Poll assignments every 15 seconds.
- Send liveness every 60 seconds.
- Record substantive progress at least every 10 minutes.
- Check STOP and generation independently of the model.
- Preserve local changes when interrupted.

### Network partition and crash rules

A missed heartbeat does **not** authorize reassignment.

If GitHub connectivity is lost for 120 seconds:

- Stop the affected model process tree.
- Preserve its worktree.
- Keep ownership unchanged.
- Report confirmed stopped status after reconnecting.

The coordinator can assign a new generation only after the previous process is confirmed stopped.

This deliberately favors avoiding duplicate work over keeping every slot busy during a partition.

The Windows machine never elects itself coordinator. Mac recovery reconciles actual PR and merge state before resuming.

### Independent review and automatic merge

Use the two teammates’ **separate GitHub identities**. GitHub does not accept the author approving their own PR; model names in comments do not solve that identity constraint.

Review requirements:

- Fresh opposite-model session.
- Review the task spec, actual diff, relevant source, tests, and evidence.
- Verify user-visible behavior, not merely whether tests exist.
- Record reviewed head SHA and base SHA.
- Return pass, changes required, or blocked.
- New commits invalidate the previous approval.

Merge requirements:

1. Current task generation is valid.
2. Required dependencies are on `main`.
3. Owned paths match base-branch policy.
4. CI passes.
5. Feature evidence exists for the current head.
6. Opposite-model review approves the current head.
7. Integration checks match current `main`.
8. STOP is absent.
9. Release time gates permit the merge.

Only one merge occurs at a time. Use the expected head SHA when merging, then wait for `main` verification before admitting another feature merge.

### Main rules for every agent

1. Work only on the assigned task.
2. One task, one active writer, one branch, one PR.
3. Never modify another task’s owned paths.
4. Never merge your own work.
5. Never bypass CI or branch protection.
6. Never loosen tests to conceal a failure.
7. Never mark mocked behavior as implemented.
8. Never rewrite accepted contracts without the contract owner’s reviewed change.
9. Never start a second implementation because the first agent is slow.
10. Never infer completion from a screenshot alone.
11. Never expand scope to stay busy.
12. Never repeat the same failed fix indefinitely.
13. Never put credentials, transcripts, or private user data into public evidence.
14. Reload specifications after restart or context loss.
15. Record blockers precisely and continue independent ready work.
16. Stop commits, merges, and deployment mutations at the release cutoff.

### Recovery and loop prevention

| Situation | Required action |
|---|---|
| Same fix fails twice | Stop repeating it; record a new hypothesis or block the task |
| Three CI repair rounds fail | Park the task with reproduction, logs, and attempted fixes |
| Worker crashes | Resume the same task; maximum two automatic restart attempts |
| Main becomes red | Suspend feature merges; prioritize fix or verified revert |
| Provider returns rate limit | Respect retry timing; preserve resumable state |
| No ready tasks | Review, verify, or wait with backoff; do not invent work |
| Ownership conflict | Coordinator resolves assignment before either writer proceeds |
| Coordinator crashes during merge | Inspect actual GitHub merge state before retrying |
| Review cannot run | Mark review blocked; do not turn it into a pass |

Unlimited budget does not remove these controls.

### Verification philosophy and Graphify

Adopt the useful pstack principle: **an agent must demonstrate the behavior it claims to have implemented**. Agent-brigade’s own verification guide cites this approach. Use one verification system, not two independent orchestration stacks. [Verification guide](https://github.com/Eric-Zhang-Developer/agent-brigade/blob/main/docs/verification.md)

Each feature recipe records:

`Action → visible result → persisted result → evidence`

Evidence includes screenshots or traces where useful, API results, relevant database assertions, and the exact commit.

Graphify runs inside each worktree:

- Query before codebase investigation.
- Initialize when necessary.
- Update after code changes.
- Keep generated graph output outside normal feature ownership conflicts.
- Publish CI graph artifacts for the merged revision rather than opening recursive graph-maintenance PRs.

The linked X post’s text was recovered, but its full video was not verified. No specific mechanism from the unseen video is treated as a requirement.

---

## 5. Automatic phases, sponsor coverage, and release acceptance

### Phase progression

These are dependency gates, not manual approval meetings. Passing a gate automatically releases the next ready tasks.

| Phase | Astra work | Opus work | Exit gate |
|---|---|---|---|
| **0 — Foundation** | Contracts, API skeleton, database, CI, runner adapters, deployment skeleton | Design tokens, application shell, Figma frames, verification fixture UI | Both computers complete a small PR/review/merge cycle; real verification runs |
| **1 — Real atlas** | Acquisition, first corpus, embeddings, retrieval, projection, tiles | Galaxy, project drawer, search, filters, timeline | Real projects can be explored and traced to sources |
| **2 — Idea loop** | Guest workspace, interpretation, placement, immutable versions, revision APIs | Idea card, spoken/text entry, star, refinement, history, comparison | Create → retrieve → revise → save → reopen works end to end |
| **3 — Evidence and challenge** | External research, evidence records, bounded challenges, assumptions, experiments | Evidence desk, critics, assumption constellation, tests, alternatives | A supported challenge changes or strengthens an idea with traceable evidence |
| **4 — Team decision** | Team profile, private voting, compare, snapshots, invites, sharing | Team convergence, feature scope, branching, decision view, mobile sharing | Two independent browsers reach and share a decision without leaking private votes |
| **5 — Presentation and enrichment** | Sponsor requirements, rehearsal generation, event ingestion, dataset analytics | Persona, demo sketch, rehearsal, QR, explanation overlay, presentation mode | Every F01–F32 scenario passes |
| **6 — Release** | Resilience, migrations, backup restore, load tests, immutable release manifest | Cross-device polish, accessibility, visual regression, recorded demo | Complete acceptance suite, sponsor evidence, submission package |

Ingestion runs throughout Phases 1–5. It does not block work that can use an already validated bundle.

After Phase 2, always retain a known-good complete core journey. Later features integrate into that journey without destroying it.

### One-time setup inputs

Before unattended operation, the two people supply or establish:

- Product GitHub repository and collaborator access.
- Distinct GitHub authentication on each computer.
- Confirmed Astra and Opus model access.
- Vultr, Neon, Gemini, ElevenLabs, Hugging Face, and Databricks credentials where used.
- A qualifying domain if pursuing GoDaddy Registry.
- Figma editing access and a shareable project file.
- Event deadline configuration.
- A successful initial deployment and credential smoke test.

Credentials remain outside Git. Missing access blocks only the dependent task and is reported once with a precise action.

For Figma, use an available authorized integration. If automated editing is unavailable, the Mac operator imports or creates the supplied frames and provides the file link while agents continue implementation.

### Sponsor strategy

The goal is coherent sponsor coverage, not adding every sponsor’s technology.

| Challenge | Plan |
|---|---|
| **Hugging Face** | Core BGE-M3 embeddings, documented model revision, retrieval evaluation, model/data usage explanation |
| **ElevenLabs** | Core speech recognition and expressive, interruptible spoken guidance |
| **Vultr** | Actual application and analytics hosting |
| **Neon** | Workspaces, versions, evidence, decisions, votes, shares; isolated development/test branches |
| **Gemini API** | Core grounded interpretation, refinement, challenge, and synthesis |
| **Databricks** | Executed corpus cleaning/quality and historical-analysis job whose exported results power coverage and timeline insights |
| **Figma** | Actual design file, usability flows, accessibility, required link and screenshot |
| **Adobe** | Cohesive visual design, typography, purposeful animation, polished share artifact |
| **GoDaddy Registry** | Qualifying public domain if available through the event offering |
| **Tiger Data** | Not added; Neon is the selected application database |
| **AMD** | Not a baseline dependency; only claim if a real ROCm deployment is deliberately implemented and verified |
| **Full Sail** | No forced entry; galaxy navigation is not automatically a pathfinding training simulation |
| **NVIDIA Jetson** | No hardware integration in this product |
| **Encompass** | No claim based solely on an ordinary laptop microphone |
| **BNY** | No financial-services claim from an investor persona or finance filter |
| **NextEra SPOT** | Excluded: its mission-data dashboard is a different product |
| **OneEthos** | No environmental-impact claim from merely suggesting environmental ideas |
| **Solana** | No unnecessary blockchain layer |
| **Presage** | No physiological or facial confidence inference |

Databricks uses the same normalization rules as local ingestion. It performs a real data-quality/history computation and publishes a versioned output consumed by the app. It must not become an unused sponsor notebook.

The sponsor mapping follows the supplied detailed challenge brief supplied during planning and the [official listings](https://knight-hacks-ix.devpost.com/). Eligibility is claimed only for demonstrated integrations.

For general awards:

- Target Overall and Best AI.
- Do not reshape the product to qualify as a game or embedded project.
- Treat the humorous “Most Useful” award as incidental.
- Do not select first-time eligibility without satisfying the actual team requirement.
- Event participation awards remain human activities.

### Rubric-driven acceptance

| Criterion | Implementation evidence |
|---|---|
| **Originality** | A meaningful evidence-backed revision, branching alternatives, and private team convergence; honest comparison with existing advisors |
| **Technical Understanding** | Both teammates can explain embeddings versus projection, state ownership, bounded workflows, voice cancellation, and one real tradeoff |
| **Functionality** | All 32 feature scenarios pass against the integrated application |
| **Design** | Coherent desktop/mobile flow, accessible alternative to 3D, intentional motion, complete error states |
| **Wow** | A judge’s spoken idea becomes a visible, inspectable, improved decision in one continuous interaction |

### Required test suite

**Coordination**

- Duplicate coordinator start.
- Duplicate worker start.
- Conflicting task-state update.
- Lost response after assignment or merge.
- Windows disconnection.
- Stale worker generation.
- Commit added after approval.
- Same-account review misconfiguration.
- Coordinator crash before and after merge.
- STOP and deadline activation.

**Data and retrieval**

- Canonical deduplication and multiple event memberships.
- Unknown or conflicting dates.
- Repeated pagination and rate limits.
- Invalid records and removed-source tombstones.
- Index recall against exact retrieval.
- Stable saved placement.
- Correct bundle/version association.
- Atomic interrupted publication.
- Large synthetic load without presenting synthetic records as real projects.

**Product behavior**

- Create and correct an idea.
- Inspect relevant alternatives.
- Accept, reject, and branch a revision.
- Complete a challenge without endless disagreement.
- Record an assumption test.
- Compare candidates.
- Reveal votes correctly.
- Save, share, revoke, and reopen.
- Preserve old shares after a new corpus release.
- Distinguish unsupported evidence and unavailable external sources.

**Voice and resilience**

- Denied microphone permission.
- Noisy or partial transcription.
- Interrupt during speech and during research.
- Late results from a cancelled turn.
- Repeated tool delivery.
- Provider timeout or quota exhaustion.
- API, eve, and analytics restart.
- Neon outage and recovery.
- Backup restoration.

**Design and performance**

- Windows and Mac browser checks.
- Narrow mobile layout.
- Keyboard navigation.
- Reduced motion.
- Contrast and focus visibility.
- Empty and partial-result states.
- Camera/selection stability during panel updates.

Initial performance gates:

- Warm local neighbors and placement within approximately two seconds.
- At least 45 FPS on the actual demo laptop at its selected detail budget.
- Faiss recall@10 of at least 0.95 against exact retrieval on the fixed evaluation sample.
- Ten consecutive successful core journeys before release.
- No stale speech or cancelled result changing the active idea.
- No duplicate saved revision after a retried operation.

These are engineering targets to verify, not claims to advertise before measurement.

### Release operations and deadlines

The official requirements specify **October 11, 2026, 10:00 AM EDT submission** and **11:00 AM EDT stop GitHub commits**, despite the page header showing 11:00 AM. A demo video and public repository are required. [Official requirements](https://knight-hacks-ix.devpost.com/)

Configure both local supervisors and the merger with those times. Do not rely only on a CI check that passed hours earlier.

Internal release targets:

- **08:00 AM:** stop expanding the judging corpus; finalize the largest validated bundle.
- **09:00 AM:** preserve a complete release candidate and begin final recording.
- **09:15 AM:** stop admitting new feature work into the judging release; fixes only.
- **09:30 AM:** finish video, screenshots, README, sponsor evidence, and team roster.
- **09:45 AM:** submit the complete entry.
- **10:45 AM:** stop automated code changes and deployments, leaving margin before the official cutoff.
- **11:00 AM:** hard stop on all Git commits and merge/deployment mutations, including the automation-state branch.

The feature implementation for live-event ingestion is included. Its judging data depends on gallery publication and organizer rules. Do not refresh after the cutoff without an established permitted policy.

If execution begins too late to satisfy these targets, report the remaining incomplete features explicitly. Do not compress verification into a false pass or silently redefine “everything.”

### Final release package

Produce:

- Public repository with clear setup instructions.
- Architecture and data-flow diagram.
- Feature coverage matrix for F01–F32.
- Actual corpus coverage and provenance report.
- Retrieval and performance evaluation.
- Model/provider identifiers and meaningful-use evidence.
- Known limitations.
- Figma file link and screenshot.
- Demo video and representative screenshots.
- Sponsor-specific demonstration notes.
- Backup and restore instructions.
- Frozen code SHA, corpus manifest, deployment identifier, and configuration version.
- Two launch prompts and supervisor commands, one for each computer.

The main demonstration should show:

**A judge speaks an idea → Uncharted finds relevant work → one challenge reveals an assumption → the idea branches → the team chooses a stronger version → the judge takes the decision home through a QR link.**

The project is complete when every feature has passed its acceptance scenario, the two-computer workflow has demonstrated safe recovery, and the released product tells the truth about what its beautiful galaxy means.
