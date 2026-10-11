import { z } from "zod";

// Sponsor challenge assessment (specs/features/sponsor-challenges-api). The response shapes here are frozen for the UI
// in specs/decisions/sponsor-challenges-api-response.md.
export class ChallengeError extends Error { constructor(readonly status: number, message: string) { super(message); } }

export const MAX_TEXT = 16_000;
export const MAX_REQUEST_BYTES = 3 * 1024 * 1024;
export const MAX_EVIDENCE = 16_000;
// A reservation outlives one generate() call (provider timeouts plus fallbacks) and Vercel's 300 s function limit, so
// an owner still working is never treated as abandoned; after it, the key is terminal and a retry needs a new key.
export const RESERVATION_MS = 300_000;

export const KINDS = ["eligibility", "required-integration", "deliverable", "judging"] as const;
export type Kind = (typeof KINDS)[number];
export type Label = "supported" | "inferred" | "unverified";

const text = (max: number) => z.string().trim().min(1).max(max);
const quote = z.string().min(1).max(2000);

// --- Brief: what the user confirms --------------------------------------------------------------------------------
export const requirementInput = z.object({ kind: z.enum(KINDS), quote, summary: text(500).nullable() }).strict();
export const criterionInput = z.object({
  name: text(200),
  quote,
  scale: z.object({ min: z.number().finite(), max: z.number().finite(), quote }).strict().nullable(),
  anchors: z.array(z.object({ points: z.number().finite(), quote }).strict()).max(10),
  weight: z.object({ value: z.number().finite().positive(), unit: z.enum(["percent", "decimal"]), quote }).strict().nullable(),
}).strict();
export const aggregationInput = z.object({ rule: z.enum(["sum", "weighted_sum", "other"]), quote }).strict();
export const rubricInput = z.object({ criteria: z.array(criterionInput).min(1).max(20), aggregation: z.array(aggregationInput).max(5) }).strict();
export const confirmInput = z.object({
  transcript: text(MAX_TEXT),
  requirements: z.array(requirementInput).max(50),
  rubric: rubricInput.nullable(),
}).strict();
export type ConfirmInput = z.infer<typeof confirmInput>;

export type Requirement = { id: string; kind: Kind; quote: string; summary: string | null };
export type Criterion = {
  id: string; name: string; quote: string;
  scale: { min: number; max: number; quote: string } | null;
  anchors: { points: number; quote: string }[];
  weight: { value: number; unit: "percent" | "decimal"; coefficient: number; quote: string } | null;
};
export type Rubric = { criteria: Criterion[]; aggregation: { rule: "sum" | "weighted_sum" | "other"; quote: string }[] };
export type Revision = { revisionId: string; challengeId: string; revision: number; transcript: string; requirements: Requirement[]; rubric: Rubric | null; createdAt: string };

// --- Draft: what import proposes -----------------------------------------------------------------------------------
export type Uncertainty = { text: string; reason: string };
export type Draft = {
  challengeId: string; title: string | null; sourceUrl: string | null;
  source: { text: boolean; image: { mediaType: string; sha256: string } | null };
  transcript: string; uncertain: Uncertainty[];
  proposed: { requirements: z.infer<typeof requirementInput>[]; rubric: z.infer<typeof rubricInput> | null };
  createdAt: string;
};
// What the model proposes from a transcript. Quotes are checked against the transcript before anything is shown.
export const proposalSchema = z.object({
  requirements: z.array(requirementInput).max(50),
  rubric: rubricInput.nullable(),
  uncertain: z.array(z.object({ text: z.string().max(500), reason: z.string().max(500) }).strict()).max(20),
}).strict();

// --- Assessment ----------------------------------------------------------------------------------------------------
export const evidenceInput = z.array(z.object({ text: text(MAX_EVIDENCE), link: z.url().max(2000).nullable() }).strict()).max(10)
  .refine((items) => items.reduce((n, item) => n + item.text.length + (item.link?.length ?? 0), 0) <= MAX_EVIDENCE, "Evidence notes and links total at most 16,000 characters");
export const assessInput = z.object({ revisionId: z.uuid(), versionId: z.uuid(), evidence: evidenceInput.default([]) }).strict();
export type AssessInput = z.infer<typeof assessInput>;

export type SourceKind = "brief" | "evidence" | "idea";
export type Citation = { source: SourceKind; sourceId: string; quote: string };
export type Reason = { text: string; label: Label; citations: Citation[] };
export type Basis = "user_evidence" | "idea_intent" | "brief_only" | "none";
export type RequirementResult = {
  requirementId: string; kind: Kind; status: "met" | "not_met" | "unknown";
  basis: Basis; reasons: Reason[]; missingProof: string | null; nextCheck: string;
};
export type CriterionEstimate = {
  criterionId: string; points: number | null; anchorQuote: string | null; reason: Reason | null; nullReason: string | null;
};
export type RubricEstimate = {
  criteria: CriterionEstimate[];
  total: number | null; maximum: number | null; rule: "sum" | "weighted_sum" | null; nullReason: string | null;
  note: "Model-assessed estimate under the confirmed rubric: not a judge's score, a ranking or an eligibility certification.";
};
export type Assessment = {
  assessmentId: string; challengeId: string; revisionId: string; versionId: string; status: "complete";
  eligibility: "met" | "conflict" | "unknown" | "no_conditions";
  requirements: RequirementResult[];
  whyFits: Reason[]; whyNot: Reason[]; stillUnknown: Reason[];
  counts: { met: number; notMet: number; unknown: number };
  rubricEstimate: RubricEstimate | null; rubricNullReason: string | null;
  evidence: { evidenceId: string; text: string; link: string | null }[];
  provenance: { model: "generated"; briefRevision: number; ideaVersionId: string; userSupplied: "Evidence notes and links are user-supplied and were not tested by the app." };
  createdAt: string;
};
export type AssessmentState =
  | Assessment
  | { assessmentId: string; status: "pending" | "failed" | "expired"; error: string | null };

// What the model returns for an assessment; the server re-checks every field (cite.ts).
const reasonOut = z.object({
  text: z.string().trim().min(1).max(600), label: z.enum(["supported", "inferred", "unverified"]),
  citations: z.array(z.object({ sourceId: z.string().max(128), quote: z.string().min(1).max(2000) }).strict()).max(4),
}).strict();
export const assessmentSchema = z.object({
  requirements: z.array(z.object({
    requirementId: z.string().max(16), status: z.enum(["met", "not_met", "unknown"]),
    reasons: z.array(reasonOut).max(3), missingProof: z.string().max(600).nullable(), nextCheck: z.string().trim().min(1).max(600),
  }).strict()).max(50),
  whyFits: z.array(reasonOut).max(6), whyNot: z.array(reasonOut).max(6), stillUnknown: z.array(reasonOut).max(6),
  criteria: z.array(z.object({
    criterionId: z.string().max(16), points: z.number().finite().nullable(), anchorQuote: z.string().max(2000).nullable(), reason: reasonOut.nullable(),
  }).strict()).max(20),
}).strict();
export type ModelAssessment = z.infer<typeof assessmentSchema>;
export type ModelReason = z.infer<typeof reasonOut>;
