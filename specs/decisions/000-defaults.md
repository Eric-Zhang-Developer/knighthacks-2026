# 000: Project-wide defaults

Agents read this after their feature spec's Defaults. Humans review it first after a run. Each row says how to
undo it.

| # | Topic | Default | Undo |
|---|---|---|---|
| D1 | | | |

## When nothing covers it
1. Keep every rule in `mission.md` exact.
2. Show "unknown / needs review" rather than guess.
3. Take the smaller change that someone else can undo.
4. Prefer deterministic code over a model call, and a model call over manual guessing.
5. Log it in `decisions/<feature>-<topic>.md`.
