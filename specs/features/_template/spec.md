---
name: One line describing the outcome
depends_on: []
owns: []
assignee: ""
---

<!-- Copy this folder to features/<slug>/ (lowercase-kebab, at most 32 characters): the folder name is the
feature's ID, used in PR titles (`feat(<slug>): ...`), its done note (changes/<slug>.md) and its branch.
owns = path prefixes (not globs) this feature alone may change while it's in flight; no entry may overlap another
in-flight feature's or a frozen path. assignee: a worker name, or empty for anyone. Add `bootstrap: true` to exactly
one feature, which may change anything and merges first; it also sets `[verify].command` in .agents/config.toml,
so every later agent can see its change running, and runs `verify.py` once to prove it works before merging. Schedule it by adding the slug to a milestone in
specs/milestones.toml; until then it's backlog. Size it so it merges as one reviewable PR, or plan it in parts. -->

# Name

## Plan
1.

## Requirements
<!-- Exact and testable. Name inputs, outputs and the rule. Say what must stay unknown rather than guessed. -->
-

## Validation
<!-- How to see it working as a user would. This is the verifier's recipe for this feature:
1. Every way a user reaches it (a command, a page, an API route). A path you skipped is not verified through another.
2. Steps as `action -> visible result`: the exact command or click, and what you should see.
3. What to keep as proof: the output, a screenshot, a response, and the state it left (a file, a row).
Plus the tests that pin it. Don't weaken these to make a change pass; change them only with the reason in the PR. -->

## Defaults
<!-- What to do when this spec is silent. "Prefer the smaller, reversible option" is the fallback. -->
