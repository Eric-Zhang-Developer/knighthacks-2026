# Reopened corpus publication

Context: the user explicitly approved publication after the earlier idea-create-api cutoff on 2026-10-10. Read-only preflight found 100 production projects and no public.idea_versions table. The separate test database has saved test versions.

Options: use the existing full projection while production has no saved ideas; add an incremental placement feature; retain the 100-record corpus.

Choice: publish through the existing specified pipeline after full test validation. Recheck production before loading and stop if saved versions exist. This avoids adding a new placement feature without need. Leave all app-state rows untouched. This approval covers one publication, then freeze again.

Undo: restore the captured projects table and matching public bundle together; preserve both the original rollback and the new release receipt outside git. If production saved ideas appear before publication, park it on #63 instead of moving or deleting them.
