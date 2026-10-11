# Red angular skin on the steel layout

**Context.** #432 gave the app a pitch-black observatory theme: red accent `#ff3b30`, square corners, solid plates,
mono capitals for controls. #483 replaced it with the live-mentor shell's steel blue (rounded pills, navy glass). The
person, 2026-10-11: "the layout of steel is great but I prefer the UI of red angular", and chose square everywhere,
the phone nav included.

**Options.** A: revert #483 (also loses its favicon fix and the phone layout rules in galaxy.module.css). B: restore
#432's tokens and move the steel colours hardcoded in the shell's CSS onto tokens, leaving every position and size
alone. C: keep steel.

**Choice.** B. `app/globals.css` is #432's file plus the later step-label fix (#471) and the `--control` tokens the
toggle reads. Shell, mentor, search, workspace and ideas CSS read `--surface*`, `--hairline*`, `--ink*`, `--accent`
and `--radius` instead of literal steel values, so the theme lives in one file again. Only circles (Fred's ring) stay
round. Chrome controls (Team, Filters, Browse the map, nav labels, the layout toggle) take #432's mono capitals,
tightened at phone width so nothing overlaps at 360 px.

**Supersedes** the steel paragraph in `specs/features/ui-redesign/spec.md` and the pill-nav wording in
`specs/features/live-mentor-ui/spec.md`; those specs get the wording in a follow-up `fix(<slug>)` PR each.

**How to undo.** Revert this PR: steel comes back as it was at 827a399.
