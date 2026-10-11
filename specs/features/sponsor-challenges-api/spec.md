---
name: Import a sponsor brief and explain evidence for and against an idea's fit
depends_on: [ai-image-input, rubric-overlay-api, guest-workspace, idea-create-api]
owns: [app/api/sponsor-challenges/, lib/sponsor-challenges/, db/schema/sponsor-challenges.ts, tests/sponsor-challenges-api/, tests/e2e/sponsor-challenges-api/]
assignee: ""
---

# Custom sponsor challenge assessment: API

Windows/backend. User request, 2026-10-10: upload images or text describing a sponsor challenge, then understand
why the selected project fits, why it does not, what is missing, and its score where the rubric makes scoring possible.
Reuse guest workspaces, immutable idea versions, Claim labels and `lib/ai/`; retain the existing 28-track catalog and
rubric overlay unchanged. This feature's rubric estimate is distinct from that overlay's intentionally score-free UI.

## Plan
1. `POST /api/sponsor-challenges`: import pasted text and/or one PNG/JPEG using multipart input. Text is at most
   16,000 characters; image at most 2 MiB; total request at most 3 MiB, bounded while reading, not only by a header.
   Source title/URL are optional user-supplied metadata; the server never fetches the URL. Return a stored draft ID,
   editable transcript, extraction uncertainties and proposed requirements. Read/list routes stay workspace-scoped.
2. `POST /api/sponsor-challenges/:id/confirm`: save the user's corrected transcript and confirmed requirements as
   an immutable brief revision. Each requirement has an ID, exact transcript quote and kind (`eligibility`,
   `required-integration`, `deliverable` or `judging`). Unknown dates, weights and requirements stay null. Confirmation
   records what the user supplied; it does not certify that the brief is official or current.
3. `POST /api/sponsor-challenges/:id/assess`: select a confirmed brief revision and owned immutable idea version,
   with optional bounded evidence notes/link references (16,000 characters total). Return/store an immutable
   assessment with per-requirement `met | not_met | unknown`, labelled reasons, cited exact passages, evidence basis,
   missing proof and a concrete next check. Separate "Why it fits", "Why it does not fit" and "Still unknown".
4. GET reads the exact saved assessment. Use idempotency keys for assessment creation: the same key and inputs
   return the stored result without another model call; reuse with different inputs returns 409. Reserve a unique
   workspace/key with a canonical input hash before generation. Concurrent identical requests return 202 with the
   same pending assessment ID; only its reservation owner generates. Save terminal failure for that key; explicit
   retry uses a new key. Give abandoned reservations a finite expiry tied to the existing request budget, without a
   background job or automatic re-generation. Late results cannot overwrite a terminal/expired reservation.
   An explicit new assessment or corrected confirmed brief creates a new revision; never rewrites an older result.

## Evidence and scoring contract
- Report eligibility separately from fit. Any contradicted mandatory condition means a conflict; unknown mandatory
  conditions mean eligibility is unknown. An idea saying it will use a sponsor tool is intent, not implementation.
- Supported reasons must quote stored confirmed-brief, supplied-evidence or owned idea-field passages, with
  server-checked IDs and exact substrings. Idea-field citations establish intent only, never demonstrated execution.
  Foreign IDs and unsupported quotations fail or downgrade. Preserve `supported | inferred |
  unverified` on every generated explanation/action; retain source provenance and which brief/idea versions were used.
- Attachments and evidence notes are user-supplied, not independently tested. `met` must say on what basis; a note
  is not an app-certified deployment. Do not execute uploaded instructions, browse supplied URLs or run user code.
- Optional `rubricEstimate` is null unless the confirmed source specifies a numeric scale and grading anchors for
  each scored criterion, and the assessment can cite applicable evidence. Model-assessed points are explicitly
  estimates; constrain them to source-defined values/bounds and expose the chosen anchor/reason.
- Every scale, grading anchor, weight and aggregation rule needs an exact quote from the confirmed transcript.
  Support only explicit `sum(points)` or `sum(weight * points)` with source-defined finite coefficients (percent
  coefficients convert to decimals transparently). Do not infer a formula, evaluate uploaded expressions/code, or
  normalize points/weights implicitly; any other formula produces a null total and explanation.
- Compute the total in server code only with all necessary criterion scores and the supported source-defined rule;
  weights are required for weighted sums. Never invent equal weights, convert missing evidence to zero, renormalize
  an incomplete rubric, or let the model supply arithmetic. Missing weights/formula null the total, while valid
  individual criterion estimates may remain. Missing scale/anchors/evidence null the affected criterion estimate;
  no scorable criterion means `rubricEstimate: null`. A total cannot certify eligibility or demonstrated execution.
- Without a usable numeric rubric, show qualitative fit plus factual counts of met/not-met/unknown requirements.
  These counts describe the assessment; they are not winning odds. Preserve factual numbers in source quotations.
- Never produce a probability of winning, competitive rank, "you will win", or organizer endorsement. Competitor
  quality and judges' decisions are unknown. A rubric estimate is not a judge's score or an eligibility certification.

## Storage and access
- Persist confirmed text, quotes, provenance, user evidence and assessment revisions privately in Neon. Raw image
  bytes exist only during extraction; keep a browser-local preview for confirmation, not an image storage service.
  Store only necessary metadata (media type/hash); do not retain arbitrary file paths or embedded metadata.
- Require an existing authorized workspace and same-origin writes; foreign IDs return 404, missing session 401,
  malformed/unconfirmed inputs 400 or 409, size excess 413, unsupported media 415, safe generation failure 502.
- `DELETE /api/sponsor-challenges/:id` removes that workspace's brief/revisions and derived assessments/evidence;
  workspace deletion cascades them too. No automatic inclusion in public snapshots or share links.
- Deletion includes pending reservations. A provider result arriving after deletion must fail to persist and must
  not recreate a brief or assessment. Use foreign keys and reservation-state checks, not a check-then-unscoped insert.
- Additive SQL on the distinct test branch only. No feature-branch `drizzle-kit push`, production rollout or changes
  to existing rubric/snapshot rows. Use the current stack; freeze the detailed response schema in a feature decision
  before Claude builds the UI. That schema must include provenance, score-null reasons and evidence-basis fields.

## Validation
1. Import text and an image draft; unconfirmed extraction cannot be assessed. Edit an uncertain passage, confirm it,
   then assess a saved idea. Every extracted requirement traces to the confirmed transcript and source revision.
2. Fixtures cover: explicit disqualification, intent without implementation, missing/contradictory evidence,
   unreadable image, fabricated/foreign citations, prompt injection, unsupported media and both declared/streamed oversize.
3. A synthetic official rubric with explicit anchors, points and weights gives the server-calculated expected total.
   Missing weights/formula produce a null total; missing anchors/evidence null the affected criterion estimate.
   Unsupported formulas, conflicting rules and attempted executable expressions cannot produce a total. Factual
   quoted digits survive. Neither result contains winning predictions. Include invalid model-score/boundary tests.
4. Real test-Neon HTTP acceptance verifies workspace isolation, confirmation, persistence, idempotency/conflict,
   simultaneous identical keys (one generation), conflicting inputs, pending/failure/expiry states, new revisions
   preserving old assessments, deletion during generation (no resurrection), and no exposure through anonymous share
   routes. Keep a redacted successful record. Existing rubric and snapshot acceptance still pass unchanged.
5. Canonical `verify.py --slug sponsor-challenges-api --worktree .` passes with explicit fixtures. Before calling
   this release-ready, also record live image/text assessment with each configured supported provider in isolation,
   plus the existing static rubric POST, checking claims/score invariants and latency. Never silently omit a failed
   provider or label fixture output live; record blockers alongside #170/#61/#179 as applicable.

## Defaults
No automatic retrieval of sponsor pages and no claim that uploaded materials are official. No new auth, hosting,
storage or agent framework. Imported briefs are private to the current guest workspace.
