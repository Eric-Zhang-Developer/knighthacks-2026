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
- **Primary experience, live mentor** (human clarification, Sat Oct 10, #345): realistic two-way spoken
  brainstorming grounded in actual project evidence, user goals and relevant judging criteria. Start -> talk ->
  contextual spoken follow-up -> inspect evidence -> refine -> confirm -> save, with natural interruption and a
  complete text fallback. This supersedes push-to-talk-only as the product's voice goal. Windows owns the
  authenticated session/grounded tool API; the user's latest explicit reassignment gives conversation UI and
  seamless idea/evidence integration to Windows worker codex-conversation-ui. Mac retains unrelated frontend work.
  The old cut short-read-back features do not satisfy it. Prioritize this ahead of optional expansion while
  preserving existing tests, schema/deployment coordination and the fixed freeze/hard stop.
- **safe-demo** (no deadline; picked first): the bootstrap feature, then a galaxy of real projects you can explore and
  search, where every star opens its source page (F01, F19, a short F20 explainer).
- **core** (no deadline; picked after safe-demo): type or speak an idea, see it become a star with neighbor evidence cards, run one
  challenge, accept a revision and see the revision trail (F03, F04, F05, F06, F07, F09). Text first, voice right
  after: voice is the Wow factor, so it is core work, not an add-on.
- **submission**, ships Sun 10:45: branches, comparison, a private team vote, a decision snapshot, and a share link
  with a QR code (F25, F16, F29, F32, F10). Then the add-ons, last in order: deploy the same app on Vultr, and a
  GoDaddy domain. Freeze from Sun 08:30; fixes and docs only from 09:00. Humans submit to Devpost by 09:45
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

Beside the product: `/foreman`, an unlisted build-status page (countdowns, what needs a person, the feature
graph, a replay of the build) for the team and the judges. It's in the final milestone's `allow`, so it never
competes for pick order.

Human work beside the agents: Figma frames (for the Figma track), the demo video, and Devpost.

## Corpus goal (person, Sat 18:10)
More real projects make every answer better: closer neighbours, fewer "nothing like it" gaps, stronger evidence.
The goal is **every hackathon project on Devpost**; the person would be happy with **100,000**. Devpost lists
13,862 ended hackathons (its API, Sat 18:05). The total project count isn't known yet; the gallery walk will
measure it.
- **Tonight, full records (#262):** title, tagline, description and technologies from each project page, at 2
  requests per second until Sun 03:00, then one release with the 2D layout (`galaxy-2d`), so the map is re-laid
  out once, not twice. Projected 45–55k; the release prints the real count.
- **Stretch, summary records:** every gallery page already lists ~24 projects (title, tagline, winner badge;
  `summaries.jsonl`, #310), so a gallery-only pass covers far more projects per request than project pages.
  They become stars marked `summary` (no description, which stays unknown), with full records where we have them.
  This needs embedding fast enough (local `bge-m3` if it passes the parity check in `corpus-embed`), a `detail`
  column, a "summary only" label wherever a record is shown or quoted, and a star file that loads quickly at 100k+.
  Specs follow once the embedding speed is measured; nothing here is scheduled yet.
- **Rules that don't bend for size:** every star links to its source page, nothing is filled in, the fetch keeps
  the 429 backoff and the 403 stop, and one machine fetches.

## Not doing
- The V3 plan's process layer: the cross-machine coordinator, `automation/state` branch, supervisors and automated
  cross-model review. Both machines run brigade workers exactly as `AGENTS.md` says: a draft PR is the claim, and
  agents merge their own green PRs.
- eve, a separate API service, a Python service, Faiss and a GPU host. pgvector covers search at our corpus size.
- Tracks we'd have to bend the product for: Tiger Data, AMD, NVIDIA, Full Sail, Encompass, BNY, NextEra, OneEthos,
  Solana, Presage, Best Game, Best Embedded.
