# Sponsor challenges: response schema (frozen for the UI)

Context: the spec freezes the response shapes before the UI is built. The TypeScript source of truth is
`lib/sponsor-challenges/contract.ts`. Changing a field below needs a `contract:` change.

Options: A) return the model's output after checking it; B) return a server-built shape, where every status, basis,
count and total comes from server code (chosen); C) return raw model output plus a separate verdict.

Choice: B.

## Routes
| Route | Body | Success | Errors |
|---|---|---|---|
| `POST /api/sponsor-challenges` | multipart: `text?` (≤16,000 chars), `image?` (PNG/JPEG ≤2 MiB), `title?`, `sourceUrl?` (stored, never fetched); request ≤3 MiB | 201 `Draft` | 400, 401, 403, 413, 415, 502 |
| `GET /api/sponsor-challenges` | none | 200 `{ challenges: { challengeId, title, latestRevision, assessments, createdAt }[] }` | 401 |
| `GET /api/sponsor-challenges/:id` | none | 200 `{ draft: Draft, revisions: Revision[], assessments: { assessmentId, revisionId, versionId, status, createdAt }[] }` | 401, 404 |
| `DELETE /api/sponsor-challenges/:id` | none | 200 `{ deleted: true }`: cascades to revisions and assessments, pending ones too | 401, 403, 404 |
| `POST /api/sponsor-challenges/:id/confirm` | JSON `{ transcript, requirements: { kind, quote, summary }[], rubric }` | 201 `Revision` (n + 1, immutable) | 400 (a quote not in the transcript, a number not stated in its quote), 404, 409 (raced) |
| `POST /api/sponsor-challenges/:id/assess` | header `Idempotency-Key`; JSON `{ revisionId, versionId, evidence?: { text, link }[] }` (≤16,000 chars) | 201 new `Assessment`; 200 replay; 202 `{ assessmentId, status: "pending", error: null }` | 400, 404, 409 (unconfirmed brief, same key with other inputs, `expired`), 502 `{ assessmentId, status: "failed", error }` |
| `GET /api/sponsor-challenges/:id/assessments/:assessmentId` | none | 200 `Assessment` or `{ assessmentId, status: pending｜failed｜expired, error }` | 401, 404 |

## Shapes
- **Draft**: `{ challengeId, title, sourceUrl, source: { text: boolean, image: { mediaType, sha256 } | null }, transcript,
  uncertain: { text, reason }[], proposed: { requirements: { kind, quote, summary }[], rubric | null }, createdAt }`.
  Proposals that don't quote the transcript appear only in `uncertain`.
- **Revision**: `{ revisionId, challengeId, revision, transcript, requirements: { id: "r1"…, kind, quote, summary }[],
  rubric: { criteria: { id: "c1"…, name, quote, scale: { min, max, quote } | null, anchors: { points, quote }[],
  weight: { value, unit: percent｜decimal, coefficient, quote } | null }[], aggregation: { rule: sum｜weighted_sum｜other,
  quote }[] } | null, createdAt }`.
- **Assessment**: `{ assessmentId, challengeId, revisionId, versionId, status: "complete",
  eligibility: met｜conflict｜unknown｜no_conditions, requirements: RequirementResult[], whyFits: Reason[],
  whyNot: Reason[], stillUnknown: Reason[], counts: { met, notMet, unknown }, rubricEstimate | null,
  rubricNullReason: string | null, evidence: { evidenceId: "e1"…, text, link }[],
  provenance: { model: "generated", briefRevision, ideaVersionId, userSupplied }, createdAt }`.
- **RequirementResult**: `{ requirementId, kind, status: met｜not_met｜unknown,
  basis: user_evidence｜idea_intent｜brief_only｜none, reasons: Reason[], missingProof: string | null, nextCheck }`.
- **Reason**: `{ text, label: supported｜inferred｜unverified, citations: { source: brief｜evidence｜idea, sourceId, quote }[] }`.
  Every citation is a known source ID with an exact substring. A `supported` reason with no surviving citation
  becomes `unverified`. Reasons predicting winning, odds or rank, or using numbers no source states, are dropped.
- **RubricEstimate**: `{ criteria: { criterionId, points | null, anchorQuote | null, reason | null, nullReason | null }[],
  total | null, maximum | null, rule: sum｜weighted_sum | null, nullReason | null, note }`.

## Rules the shape encodes
- `basis` and `status` come from the server. Idea text is `idea_intent`: it can make a judging requirement `met`, but
  never an eligibility, integration or deliverable one. Those need a user evidence note, and become `unknown` with a
  `missingProof` otherwise. `not_met` needs a cited idea or evidence passage.
- `eligibility` is `conflict` if any eligibility requirement is `not_met`, `unknown` if any is `unknown`.
- `total` is computed only for one quoted `sum` or `weighted_sum` rule with every criterion estimated (and every
  weight, for a weighted sum). Otherwise `total: null` with `nullReason`, and the valid criterion estimates stay.
  `rubricEstimate: null` when no criterion is scorable. `counts` describe the assessment, not winning odds.

How to undo: a `contract:` PR that changes this file and `contract.ts` together.
