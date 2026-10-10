# Classification review, corpus 2026-10-10-8409 (agent-reviewed)

Agent-reviewed by mac-claude-classify on 2026-10-10: four reviewer agents read the full source text of every sampled
project; the prize strings were reviewed by mac-claude-classify. Nobody has reviewed these by hand.
Sample pack: `corpus/classify/review.py`, artifact sha256 `684ee3bb…25d40`, source sha256 `22c4eb84…52fe06`.

## Full run (Validation 2)
```
classify: loaded 8409 records, version 2026-10-10-8409
{"calls":5,"corpus_version":"2026-10-10-8409","distinct_prizes":263,"domains":{"accessibility":167,"civic":419,"climate":435,"commerce":826,"devtools":886,"education":830,"finance":606,"games":669,"health":808,"insufficient_text":66,"mobility":211,"productivity":1620,"science":174,"security":503,"social":189},"failed_prizes":0,"failed_projects":0,"prize_kinds":{"category":91,"other":30,"participation":141,"placement":104,"sponsor":125},"records":8409,"statuses":{"clear":7948,"insufficient_text":66,"mixed":395}}
classify: verified 8409 records, version 2026-10-10-8409
```
`calls` counts only the last resume. 304 project batches came from the Windows checkpoint. On the Mac, Gemini
received 63 requests: 52 + 5 from the runner and 6 diagnostics. They covered 33 project batches and 11 prize batches,
including the 5 prize batches re-run after the place fix. Before that, 88 attempts failed TLS locally and never reached
Gemini.
`insufficient_text`: 66 of 8,409 (0.78%). Largest domain: productivity, 1,620 (19.3%), under the 30% inspect bar.

## Projects (112 distinct ids; groups overlap)
| Group | n | Domain correct / incorrect / ambiguous | dev_tools correct / incorrect / ambiguous |
|---|---|---|---|
| 50 random | 50 | 42 / 0 / 8 | 49 / 1 / 0 |
| 3 per domain (14 domains) | 42 | 38 / 1 / 3 | 38 / 0 / 4 |
| 20 mixed or insufficient_text | 20 | 19 / 0 / 1 | 18 / 0 / 2 |
| All distinct ids | 112 | 99 / 1 / 12 | 104 / 1 / 7 |

Incorrect:
- `33b85d6237…` GhostGrid: `social`, clear. It's an emergency mesh network (SOS, survivor tracking), so `civic` fits better.
- `b899fbbece…` Bescholor: dev_tools `unknown`, but it says "We used AI-assisted development to rapidly turn the
  concept into a functional web experience." The evidence check needs a named tool or "AI-assisted code", so even a
  `reported` answer would have been downgraded. That's the conservative side, not a guess.

Patterns among the ambiguous ones:
- The taxonomy has no media or creative domain, so film and video tools are split across games, productivity and
  commerce.
- Some items are labelled `clear` where `mixed` fits better.
- Several projects tag a coding assistant (claude-code, copilot, lovable, antigravity) in `technologies` but never
  mention it in the description. The rule needs a description quote, so these stay `unknown`.

## Prize strings (all 263)
correct 230 · incorrect 1 · ambiguous 32.
- Incorrect: "Track 2 - AI Grants India Credits" is labelled `category`. It's a sponsor credit, as its Track 1 twin is
  labelled.
- Ambiguous:
  - Product names recorded as the sponsor ("Gemini", "Gemini API", "Snap Kit").
  - Organizers that may not be sponsors ("ACM UCF", "CSC", "Leading Learners").
  - Track placements labelled `category` rather than `placement`.
  - "Top N" and honorable mentions split between `other` and `participation`.
  - Reward brands (CodeCrafters, Formaloo, Dodo Payments), with the sponsor recorded inconsistently.
- Inferred places such as "Winner", "Grand Winner", "First Runner-Up" and the typo "2st Place" stay `place: null`.
  They're never guessed.
