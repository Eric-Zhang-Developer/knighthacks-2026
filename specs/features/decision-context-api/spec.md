---
name: Persist team fit and version-specific feature scope
depends_on: [guest-workspace, idea-revisions-api, decision-snapshot-api, share-qr-api]
owns: [app/api/decision-context/, lib/decision-context/, db/schema/decision-context.ts, lib/snapshots/contract.ts, lib/snapshots/service.ts, tests/decision-context-api/, tests/e2e/decision-context-api/]
assignee: ""
---

# Team fit (F15) and scope selection (F17): API

Windows implementation after this plan is human-merged. Existing Next route handlers, Neon/Drizzle,
Zod and `lib/ai/generate` only; no framework or dependency changes. This is not F08: comparing two
arbitrary ideas does not implement a before/after diff of revisions, neighbors, assumptions and evidence.
F08 requires a separate feature; this slice makes no before/after or originality claim.

## Contract
1. All routes below require the existing guest workspace cookie through `requireWorkspace`.
   Authorize every version, recommendation, selection and snapshot through its workspace before AI or writes.
   Return 401 without session, 404 for absent/foreign resources, 400 for invalid input, 409 for stale revision,
   and safe retryable 502 for generation failure. Mutations enforce the existing same-origin policy.
2. `GET /api/decision-context/profile` -> `{profileRevision, profile}`; initially `{profileRevision:0, profile:null}`.
   `PUT` to that route accepts `{expectedRevision, profile}` and returns the newly persisted `{profileRevision, profile}`.
   `Profile = {interests:string[], skills:string[], hardware:string[], hoursLeft:number|null,
   teamSize:number|null, enthusiasm:1|2|3|4|5|null}`. Arrays have at most 12 trimmed entries of 80 chars;
   hoursLeft is 0.25..72, teamSize integer 1..20. Empty/null means unknown, not unavailable or zero.
   This is a voluntarily shared team profile, not a private teammate sentiment or vote.
3. `POST /api/decision-context/versions/:versionId/recommendations` accepts `{profileRevision}`.
   Store an insert-only recommendation using that exact saved profile, immutable idea fields, and existing
   saved evidence. Return `{recommendationId,versionId,profileRevision,features,createdAt}`.
   Features (1..8) are `{id,title,demoStep,recommendedScope,reason,profileInfluences}`;
   IDs are server-assigned UUIDs stable within that recommendation; scope is `core|optional|later`.
   Title, demoStep and reason use `{text,label,sourceIds}` claims (text <=120/400/400 chars respectively).
   `profileInfluences` lists `{field,value,tradeoff}` using only supplied profile keys/values; tradeoff is inferred.
   Missing inputs produce visible unverified gaps, never invented skills, devices, enthusiasm or availability.
   Revision 0 uses an entirely unknown profile. Validate generated influence values against the stored profile
   and source IDs against the retrieved evidence; reject unsupported references. Profile text is data, never instructions.
4. Profile changes must affect the decision: the model proposes each candidate feature with its requirements
   (`{skills:string[], hardware:string[], hours:number|null}`, stored on the recommendation); application code, not
   the model, assesses skill match, available hardware, time, interests and enthusiasm against them and sets
   `recommendedScope`, so the same candidates and profile always give the same scopes. Explain each
   affected recommendation with exact inputs and the resulting scope tradeoff. Unknown hardware cannot justify
   excluding a feature as impossible. No fit percentage, eligibility assertion, prize odds or win probability.
   Do not merely echo profile metadata. For identical candidates, reducing known time or removing a required
   available device must change an affected scope recommendation or explicitly explain an unchanged choice.
5. `POST /api/decision-context/versions/:versionId/selections` accepts `{recommendationId,
   expectedSelectionRevision,choices:[{featureId,scope}]}` (revision 0 before any selection). Require each recommended ID exactly once, no
   extra/duplicate IDs, at least one core item, and the same version. Append an immutable selection revision;
   serialize the revision check and insert atomically. Return `{selectionId,selectionRevision,versionId,
   recommendationId,choices,demoSketch,createdAt}`. Demo sketch is deterministically the selected core items'
   saved demoStep claims in recommendation order; optional/later items remain visible outside the sketch.
6. `GET /api/decision-context/versions/:versionId` returns `{recommendation,selection}` (null/null
   initially), with the newest saved recommendation (the item 3 response shape) and selection (the item 5 response
   shape plus `profileRevision`). Each selection includes its
   exact recommendation and profile revision so regeneration cannot reinterpret old choices. No implicit AI call.
   Recommendation regeneration does not move existing choices; selection starts explicitly for the new IDs.
7. Extend existing `SnapshotData` additively with optional `scope:{selectionId,features,choices,demoSketch}`.
   Existing `POST /api/snapshots {versionId}` freezes the latest committed selection for that exact version in
   the same database statement/transaction as the original snapshot. Copy only feature ID/title/demoStep and
   scope choices; exclude profile, influence explanations, votes, transcripts and private notes. No saved scope
   means absent scope, preserving old clients and snapshots. Never resolve scope dynamically on a read.
   Existing GET, workspace history, `POST /api/shares`, public GET and QR operate on that same snapshot ID/JSON;
   no parallel snapshot table or endpoint. Share API needs no shape rewrite. Retain old snapshot bytes unchanged.

## Storage and integration
- Own new paths plus the two precise snapshot integration files, available after dependencies finish and no competing claim exists. Never alter idea versions,
  existing plan rows, stored snapshots, shared store or another feature's schema. Existing build-plan API remains intact;
  this feature's demo sketch is the scope-adjusted proposal, not a silent rewrite of an old generated plan.
- New tables hold profile revisions, recommendations, selections; use UUID PKs,
  workspace/version foreign keys, created timestamps and unique revision constraints. Authorize every join.
  Cascade cleanup with workspace/version deletion. A generation completing after deletion must not recreate data.
- Reviewed additive SQL and shape checks live in `specs/decisions/decision-context-api-schema.md`; apply to an
  isolated development/test branch only after review. No schema push, destructive SQL or production writes;
  production application is separately approved and coordinated under the existing database safety contract.

## Validation
1. Real test DB: save profile, restart/reopen with same cookie, GET exact values; different workspace cannot read
   or mutate them. Two writes with the same expected revision yield one success and one 409.
2. Stub AI only at provider boundary: assert the prompt contains exact saved profile/idea/evidence. With the stub
   returning identical candidates for both, a profile with less time, or without a required device, changes an
   affected `recommendedScope` (or explains why not) through the application-code assessment, not canned responses.
   One live provider run is recorded separately; absent live credentials are an explicit gap, never a pass.
3. Persist core/optional/later, reopen via GET and assert IDs, choices and core-only sketch. Reject foreign, duplicate,
   missing or wrong-version IDs; concurrent stale saves cannot overwrite a choice. Switching versions leaks nothing.
4. Freeze scoped snapshot; alter profile, regenerate, save different scope and accept a new idea revision;
   GET old snapshot remains byte-identical, while a new snapshot contains the new core sketch. Public share GET
   returns the same scope without cookies and excludes private fields; revoke returns 410. Legacy snapshots still work.
5. Unit/routes plus `tests/e2e/decision-context-api/` cover 1–4 using the real server/test DB. Run tech-stack Checks
   and the existing `verify.py --slug decision-context-api --worktree .`; retain responses and persisted row IDs.
