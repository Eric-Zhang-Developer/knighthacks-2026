# Roadmap

<!-- The why and the shape of the plan, for people. What ships when, and in what order, lives in
specs/milestones.toml; each feature is a folder in specs/features/. Keep the scheduled work at about 2x what agents
can finish before the next milestone. -->

## Where this is going
The demo: a judge speaks an idea, Uncharted finds related real projects, one challenge exposes an assumption, the
idea branches, the team picks the stronger version, and the judge leaves with a QR link. The prize we are building
for is Best Overall (and Best AI). Each milestone keeps a working demo, so the ambitious version never risks the
safe one. Feature IDs (F01–F32) refer to the catalog in `docs/UNCHARTED_V3_PLAN.md` §2.

## Milestones
- **safe-demo** (no deadline; picked first): the bootstrap feature, then a galaxy of real projects you can explore and
  search, where every star opens its source page (F01, F19, a short F20 explainer).
- **core** (no deadline; picked after safe-demo): type or speak an idea, see it become a star with neighbor evidence cards, run one
  challenge, accept a revision and see the revision trail (F03, F04, F05, F06, F07, F09). Text first, voice right
  after: voice is the Wow factor, so it is core work, not an add-on.
- **submission**, ships Sun 10:45: branches, comparison, a private team vote, a decision snapshot, and a share link
  with a QR code (F25, F16, F29, F32, F10). Then the add-ons, last in order: deploy the same app on Vultr, and a
  GoDaddy domain. Freeze from Sun 06:00; fixes and docs only from 09:00. Humans submit to Devpost by 09:45
  (hard deadline 10:00). Final code push: 11:00.
- **submission, second wave** (added Sat 12:15 once the first wave was done): a live run of every AI route
  (live-smoke), the rubric and sponsor overlay (F11), strongest alternative (F26), prove it in ten minutes (F27),
  meaningful combinations (F28), what would change your mind (F23) and show me the moment (F30). Each is split into a
  Windows API half and a Mac UI half that renders inside a finished panel.
- **submission, third wave** (person's go, Sat 13:20): assumption constellations (F24), GitHub and Hugging
  Face research labelled product versus building block (F13, F14), and problem evidence through Gemini search
  grounding (F12). Demo rehearsal (F18) is in the next wave.
- **submission, infrastructure and polish** (added Sat 13:30 at the person's request): `db-sync` first, an
  additive-only schema sync with health reporting missing tables, because production lost two tables within an hour
  of #113. Then polish where the demo is weakest: a reload keeps the chosen idea, snapshots and share links
  (revocable later), and search filters by event and year. (Camera flight belongs to experience-shell, #222.) Then demo rehearsal
  (F18): a pitch from what is actually built and three judge questions.
- **Backlog** (no milestone, never picked unless a `plan:` PR moves it): every other F-ID, and Databricks.

## Sponsor briefs: user-requested addition, 2026-10-10

Add a "Sponsor challenges" section to the existing decision flow. A team pastes a brief or uploads an image,
reviews and confirms extracted requirements, then compares a saved idea and supplied proof against those rules.
Explain why it fits, why it does not, what remains unknown, and what evidence would help. A numeric estimate is
available only when the confirmed source supplies a usable grading scale and anchors; a total also requires a
supported explicit aggregation rule and any required weights. Missing rules/evidence stay unknown. This is rubric assessment, not predicted
winning odds, a judge's score or certification of an uploaded brief's authenticity.

The existing 28-track overlay stays intact and score-free; its UI shipped in Claude/Mac's #188. The addition is
three separately owned features: `ai-image-input` (Windows shared client), `sponsor-challenges-api` (Windows), then
`sponsor-challenges-ui` (Claude/Mac). Append them after the accepted third-wave features, before demo-flow.
The UI keeps its own component and coordinates its shared app mount with proposed experience-shell #222;
it belongs in the contextual decision area on desktop and phone, preserving the existing rubric panel.
This adds no framework, OCR/storage service or dependency, and does not change freeze, cut or hard-stop dates.

First finish owned fixes and release blockers: #181 snapshot evidence, #170/#179 live provider failures, #61 Claude
configuration, and #113/#171 production acceptance. New scope is not a reason to call those complete. The gap audit
and cross-machine handoff are in `specs/context/findings.md`; production and user acceptance remain separate from CI.

## Beyond hackathons: product direction, not this release

Uncharted can become an evidence-backed workspace for choosing what to build and which opportunities to pursue.
The reusable loop is **bring a problem or brief -> compare relevant prior work -> expose assumptions -> collect
evidence -> decide what to build or change**. Hackathons and Devpost are the first setting and source, not the limit.

1. **Next setting:** user-supplied innovation challenges, accelerator/open-call briefs and internal product proposals.
   Reuse versioned briefs, criteria, evidence, counterarguments and decision records; keep each opportunity's rules
   distinct rather than mixing incomparable scores.
2. **Next sources:** opt-in imports from other project showcases, public repositories, research and permitted team
   documents. Before each connector: establish access permission/licensing, source URL or private source identity,
   timestamps, deduplication and source-specific limitations. Preserve source and embedding/corpus versions. Do not
   scrape arbitrary sites or imply current Devpost data represents the entire market.
3. **Next users:** product teams and startup builders evaluating alternatives, technical feasibility and customer
   evidence. Test this with an actual workflow and feedback before designing accounts, organizations or paid plans.

Keep the current Next.js/Neon architecture until measured needs justify a separately approved change. Private
documents must not leak into public search or share links; future imports need a clear retention/deletion policy.
No new connectors, corpus migration, market-size claims, accounts, monetization or broader deployment are scheduled
by this vision. Promote a slice only through a later plan with an owner, acceptance criteria and real user evidence.

Beside the product: `/foreman`, an unlisted build-status page (countdowns, what needs a person, the feature
graph, a replay of the build) for the team and the judges. It's in the final milestone's `allow`, so it never
competes for pick order.

Human work beside the agents: Figma frames (for the Figma track), the demo video, and Devpost.

## Not doing
- The V3 plan's process layer: the cross-machine coordinator, `automation/state` branch, supervisors and automated
  cross-model review. Both machines run brigade workers exactly as `AGENTS.md` says: a draft PR is the claim, and
  agents merge their own green PRs.
- eve, a separate API service, a Python service, Faiss and a GPU host. pgvector covers search at our corpus size.
- Tracks we'd have to bend the product for: Tiger Data, AMD, NVIDIA, Full Sail, Encompass, BNY, NextEra, OneEthos,
  Solana, Presage, Best Game, Best Embedded.
