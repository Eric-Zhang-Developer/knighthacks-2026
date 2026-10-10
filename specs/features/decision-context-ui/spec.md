---
name: Edit team fit and select the scope of the chosen idea
depends_on: [decision-context-api, build-plan-ui, decision-snapshot-ui, share-qr-ui, workspace-restore-ui]
owns: [components/decision-context/, components/plan/index.tsx, components/snapshot/index.tsx, components/share/SharedSnapshot.tsx, tests/decision-context-ui/, tests/e2e/decision-context-ui/]
assignee: "eric-frontend-agent"
---

# Team fit (F15) and scope selection (F17): UI

Mac implementation after this plan and all dependencies are merged. During Windows API work, Mac may prepare
owned components against the exact typed contract in isolation; claim/merge follows dependencies. No shell work.

## Plan
1. Mount `components/decision-context/` once in `components/plan/index.tsx`, next to the existing `PlanView`.
   That one integration file is available only after `build-plan-ui` finishes and no competing PR owns it.
   Pass active version ID; keep existing PlanView behavior/tests intact. Do not edit shell, page, layout, shared
   store or design-refresh paths (including the shell work in #335).
2. Show a labelled shared team-profile form for interests, skills, hardware, remaining hours, team size and
   enthusiasm; leave unknown values empty. Explicitly say teammates can read this profile. Save on action;
   reload uses the saved profile, with accessible pending/saved/error states and no false success on failure.
3. Generate scope recommendations explicitly for the active saved version and profile revision. Each feature
   shows its proposed scope, reason and how supplied profile inputs affected it, with textual ClaimBadge labels.
   If profile changes after generation, show that the recommendation uses the earlier profile and offer regenerate.
4. Radio groups label each feature core/optional/later. Local edits preview only core demo steps immediately;
   Save persists the complete choice set. Label unsaved edits and preserve them after errors; a 409 offers reload,
   never silently overwrites another teammate. Switching versions discards no unsaved work without a visible choice.
5. Read version-specific saved choices and sketch on reopen. Disable save/freeze during loading or pending writes;
   ignore late responses for an old version. Regeneration keeps earlier saved selection readable until new choices
   are explicitly saved; core/optional/later changes do not mutate the underlying immutable idea version.
6. Preserve the existing Decide -> Choose -> snapshot history -> Share/QR flow. Explain that only saved scope
   is frozen when Choose is pressed; unsaved edits never masquerade as saved scope. Extend the two precisely
   owned snapshot renderers (`components/snapshot/index.tsx`, `components/share/SharedSnapshot.tsx`) to show
   core demo sketch and optional/later choices from frozen `scope`, via a reusable component in the new folder.
   Legacy snapshots with no scope show a visible not-recorded state. Use the existing snapshot ID/share token;
   no second decision artifact or changes to QR/revocation. These files are available only after dependencies
   finish with no competing claim; preserve their existing evidence, history, sharing and restoration behavior.
   Coordinate the snapshot file with the Mac owner of initialization bug #288 before editing. Preview the exact
   publicly shared scope; explain that feature titles/demo steps become public while team-profile fields do not.
7. Keep existing full build-plan tour/timeline clearly labelled separately from the scope-adjusted demo sketch.
   Do not claim selecting scope rewrites the old plan or implements F08 before/after comparison.

## Requirements
- Use existing PanelState and ClaimBadge, text-first keyboard controls, visible focus and error messages.
- At 390px no horizontal overflow and controls at least 44px; at desktop preserve the existing panel layout.
- No API call on each keystroke, no automatic paid generation, no fabricated defaults or success metrics.

## Validation
1. Through the real UI/server/test DB, save all profile fields, reload and inspect persistence. Generate with two
   deliberately different profiles; verify the rendered recommendation explains the affected scope tradeoff.
2. Choose one item in each scope, save, reload and verify the exact persisted selection and core-only sketch.
   Switch to another version and back; old responses/choices cannot leak into the new version.
3. Freeze, reopen from history, change scope and freeze again: old snapshot stays unchanged and new snapshot
   reflects selected scope. Open its existing QR/share URL without cookies: same frozen sketch, no private profile;
   revoke -> 410. Inspect server GET responses and DOM. Old snapshots without scope remain readable.
4. Test failure/retry, stale-write conflict and unsaved version switch. Existing build-plan UI/e2e still pass.
   Keyboard-only and 390px/1440px checks retain screenshots, but assert end state rather than screenshot existence.
5. `tests/e2e/decision-context-ui/` covers 1–4 with provider-only AI stubs; run tech-stack Checks and existing
   `verify.py --slug decision-context-ui --worktree .`. Record live provider/reopen evidence separately from stub CI.


