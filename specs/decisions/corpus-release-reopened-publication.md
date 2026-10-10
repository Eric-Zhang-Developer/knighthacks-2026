# Reopened corpus publication

Context: the user explicitly approved publication after the earlier idea-create-api cutoff on 2026-10-10. Read-only preflight found 100 production projects and no public.idea_versions table. The separate test database has saved test versions.

Options: use the existing full projection while production has no saved ideas; add an incremental placement feature; retain the 100-record corpus.

Choice: publish through the existing specified pipeline after full test validation. Recheck production before loading and stop if saved versions exist. This avoids adding a new placement feature without need. Leave all app-state rows untouched. This approval covers one publication, then freeze again.

Undo: restore the captured projects table and matching public bundle together; preserve both the original rollback and the new release receipt outside git. If production saved ideas appear before publication, park it on #63 instead of moving or deleting them.

Publication completed once on 2026-10-10: production loaded 8,409 records at 17:36:27Z after the test release and a fresh zero-saved-ideas guard. The ideas table had been created since the initial preflight, so a share lock guarded it during the load. The old 100-record binary table and bundle were retained. PR #191 merged as 21f98bf; the deployed galaxy showed 8,409 projects at 17:39:40Z, the public bundle matched the tested SHA256 exactly, and deployment verification passed at 17:39:42Z. All five production golden searches passed. The corpus is frozen again; no hourly repeats are authorized.
