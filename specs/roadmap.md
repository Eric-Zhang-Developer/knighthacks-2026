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
- **Backlog** (no milestone, never picked unless a `plan:` PR moves it): every other F-ID, and Databricks.

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
