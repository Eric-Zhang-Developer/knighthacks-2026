---
name: Upload sponsor challenge images or text and inspect fit, gaps and rubric estimates
depends_on: [sponsor-challenges-api, rubric-overlay-ui, experience-shell]
owns: [components/sponsor-challenges/, app/page.tsx, tests/sponsor-challenges-ui/, tests/e2e/sponsor-challenges-ui/]
assignee: ""
---

# Sponsor challenges: UI

Claude/Mac only. The static rubric UI shipped in #188; preserve its snapshot files and score-free policy.
This feature adds `components/sponsor-challenges/` in the contextual decision area on desktop and phone.
Wait for experience-shell, then mount the new section in its Decide destination with one line in `app/page.tsx`,
after the decision snapshot (`specs/decisions/sponsor-challenges-ui-mount.md`: the `components/rubric/index.tsx`
wrapper this spec first named doesn't exist). Keep the static track overlay's content and behavior unchanged, edit no
shell file, and preserve the shell's phone/desktop acceptance.

## Plan
1. A discoverable "Sponsor challenges" section lets the user paste challenge text, select/drag one PNG or JPEG,
   or supply both. Show limits and a text fallback. Optional source title/link are visibly user-supplied.
2. Show a browser-local image preview beside the editable extracted transcript. Mark unreadable/uncertain text
   and missing requirements; require an explicit "Confirm requirements" step before assessment. Text imports also
   receive this review step. Revoke local preview URLs when replaced/closed; never upload preview bytes to analytics.
3. Choose the saved idea version and optionally attach proof as text/link references. "Assess fit" shows the brief
   revision and idea version, eligibility conflicts, "Why it fits", "Why it does not fit", "Still unknown" and
   actionable missing proof. Each explanation shows its ClaimBadge and expandable source quotation.
4. If available, show "Estimated rubric score" with criterion points, confirmed-source anchors/weights, calculation
   and evidence basis. Otherwise say why a score cannot be calculated and show qualitative results and counts.
   Always explain: this assesses the supplied rubric and evidence, not the probability of winning or a judge's score.
5. Provide read/reload, explicit reassessment, corrected-brief revision and delete controls. Identify older revisions
   when viewing history. Public `/s/:token` never fetches or exposes private sponsor briefs or assessments.

## Requirements
- Preserve the existing 28-track overlay and its no-score presentation; do not repurpose its proof field as an
  official score or certification. A user-uploaded screenshot is not automatically an official sponsor rule.
- Keyboard-accessible upload button, labelled textarea, focus/error feedback, loading and retry states, mobile
  layout and complete text-only operation. Announce validation errors; never communicate status by color alone.
- Never render extracted HTML, follow uploaded instructions or load remote URL previews automatically. Use the
  API's statuses/scores; no browser-side invented defaults, points, weights, win badges or percentage chances.
- Without evidence, integration/eligibility remains unknown rather than a green success. Failed extraction or
  generation preserves the user's editable text and supports retry within the existing request flow.

## Validation
1. Browser flow: paste/image -> edit uncertain transcript -> confirm -> choose idea -> assess -> inspect cited
   reasons -> reload saved assessment. Capture a desktop and phone-width screenshot of the section.
2. Cover rubric score with explicit anchors/weights and missing-score explanation; contrast supported evidence,
   stated intent, disqualification and unknowns. Assert no winning probability or user-proof certification appears.
3. Exercise keyboard/text-only use, oversize/invalid image, unreadable image, provider failure, revision/reassessment,
   deletion and workspace isolation. Anonymous share view does not request or reveal sponsor data.
4. Canonical `verify.py --slug sponsor-challenges-ui --worktree .` and existing rubric-overlay/snapshot UI acceptance
   pass. Coordinate release screenshots with Mac; Windows does not implement these frontend paths.

## Defaults
Keep this section in the existing decision flow; no new dashboard, design system or separate app.
