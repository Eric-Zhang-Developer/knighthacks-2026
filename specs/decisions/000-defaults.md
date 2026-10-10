# 000: Project-wide defaults

Agents read this after their feature spec's Defaults. Humans review it first after a run. Each row says how to
undo it.

| # | Topic | Default | Undo |
|---|---|---|---|
| D1 | Where a new idea's star sits | The mean of its 5 nearest neighbors' 3D coordinates, saved with the version. Display only: similarity still comes from embeddings | Fit a UMAP transform and re-place saved ideas |
| D2 | Corpus size | Whatever passes validation by the core milestone. No count is promised; the UI shows the real count | Re-run `corpus/` and reload |
| D3 | Corpus source | Public project pages of past hackathons, paced, robots.txt respected. If a source disallows it, file `needs-human` and use the next source | Drop that source's rows by their source field |
| D4 | Model IDs | Gemini and embedding model IDs in env vars; the bootstrap feature records the values it tested in `decisions/` | Change the env var |
| D5 | Guest identity | A random session ID in an HttpOnly cookie; a teammate joins through a single-use invite link; 2 members max | Add accounts later; sessions keep working |
| D6 | Schema changes | `drizzle-kit push`, no migration files; demo data is disposable | Generate migrations from the schema files |

## When nothing covers it
1. Keep every rule in `mission.md` exact.
2. Show "unknown / needs review" rather than guess.
3. Take the smaller change that someone else can undo.
4. Prefer deterministic code over a model call, and a model call over manual guessing.
5. Log it in `decisions/<feature>-<topic>.md`.
