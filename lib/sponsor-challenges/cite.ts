import type { Assessment, Basis, Citation, Kind, ModelAssessment, ModelReason, Reason, RequirementResult, Revision, SourceKind } from "./contract";
import { numbers, scoreRubric } from "./rubric";

// The model proposes; this file decides. Citations survive only with a known source ID and an exact quote. Statuses,
// evidence basis, eligibility, counts and every number in a rubric total are computed here.

export type Sources = Map<string, { kind: SourceKind; texts: string[] }>;
export function sourcesFor(revision: Revision, evidence: { evidenceId: string; text: string; link: string | null }[], idea: { versionId: string; fields: (string | null)[] }): Sources {
  const map: Sources = new Map();
  map.set(revision.revisionId, { kind: "brief", texts: [revision.transcript] });
  for (const e of evidence) map.set(e.evidenceId, { kind: "evidence", texts: [e.text, ...(e.link ? [e.link] : [])] });
  map.set(idea.versionId, { kind: "idea", texts: idea.fields.filter((f): f is string => Boolean(f?.trim())) });
  return map;
}

const PREDICTS = /\bchance\b.{0,40}\bwin|\b(?:will|likely|unlikely|certain|guaranteed|expect(?:ed)?|should)\b.{0,30}\bwin|\bwin(?:ning)?\b.{0,30}\b(?:chance|likelihood|odds|probability|estimate)\b|\bodds\b|\bprobabilit(?:y|ies)\b|\brank(?:ed|ing|s)?\b|\bendorse/iu;
/** Prose may repeat numbers that the sources state; any other number, or a winning prediction, drops the reason. */
export function allowedProse(text: string, sources: Sources) {
  if (PREDICTS.test(text)) return false;
  // Compared as whole numbers, not substrings: "1" is not stated by a brief that only says "10".
  const stated = new Set([...sources.values()].flatMap((s) => s.texts.flatMap(numbers)).map((n) => Math.abs(n)));
  return numbers(text).every((n) => stated.has(Math.abs(n)));
}

export function checkReason(reason: ModelReason, sources: Sources): Reason | null {
  if (!allowedProse(reason.text, sources)) return null;
  const citations: Citation[] = [];
  for (const c of reason.citations) {
    const source = sources.get(c.sourceId);
    if (source && source.texts.some((t) => t.includes(c.quote))) citations.push({ source: source.kind, sourceId: c.sourceId, quote: c.quote });
  }
  // A "supported" reason that lost its citations (foreign IDs, paraphrased quotes) is downgraded, never kept.
  const label = reason.label === "supported" && !citations.length ? "unverified" : reason.label;
  return { text: reason.text, label, citations };
}
const checkAll = (reasons: ModelReason[], sources: Sources) => reasons.map((r) => checkReason(r, sources)).filter((r): r is Reason => r !== null);

function basisOf(reasons: Reason[]): Basis {
  const kinds = new Set(reasons.flatMap((r) => r.citations.map((c) => c.source)));
  return kinds.has("evidence") ? "user_evidence" : kinds.has("idea") ? "idea_intent" : kinds.has("brief") ? "brief_only" : "none";
}
// What can show a requirement is met. Idea fields state intent, so they never show an integration, a deliverable or
// eligibility: only the user's evidence notes can, and those are user-supplied, not tested.
const SHOWS: Record<Kind, Basis[]> = {
  eligibility: ["user_evidence"], "required-integration": ["user_evidence"], deliverable: ["user_evidence"], judging: ["user_evidence", "idea_intent"],
};

export function normalizeAssessment(model: ModelAssessment, revision: Revision, sources: Sources): Omit<Assessment, "assessmentId" | "challengeId" | "versionId" | "evidence" | "provenance" | "createdAt" | "status"> {
  const requirements: RequirementResult[] = revision.requirements.map((req) => {
    const m = model.requirements.find((r) => r.requirementId === req.id);
    if (!m) return { requirementId: req.id, kind: req.kind, status: "unknown", basis: "none", reasons: [], missingProof: "Not assessed.", nextCheck: "Check this requirement against the brief by hand." };
    const reasons = checkAll(m.reasons, sources), basis = basisOf(reasons);
    let status = m.status, missingProof = m.missingProof;
    if (status === "met" && !SHOWS[req.kind].includes(basis)) {
      status = "unknown";
      missingProof ??= basis === "idea_intent" ? "The idea states intent; no supplied evidence shows it is done." : "No cited evidence shows this is met.";
    }
    // A conflict needs a cited passage from the idea or the evidence, not just the brief's own wording.
    if (status === "not_met" && !reasons.some((r) => r.citations.some((c) => c.source !== "brief"))) {
      status = "unknown";
      missingProof ??= "No cited passage shows a conflict.";
    }
    return { requirementId: req.id, kind: req.kind, status, basis, reasons, missingProof, nextCheck: m.nextCheck };
  });
  const eligibilityRows = requirements.filter((r) => r.kind === "eligibility");
  const eligibility = !eligibilityRows.length ? "no_conditions" : eligibilityRows.some((r) => r.status === "not_met") ? "conflict" : eligibilityRows.some((r) => r.status === "unknown") ? "unknown" : "met";
  const counts = { met: 0, notMet: 0, unknown: 0 };
  for (const r of requirements) {
    if (r.status === "met") counts.met++;
    else if (r.status === "not_met") counts.notMet++;
    else counts.unknown++;
  }
  let rubricEstimate = null, rubricNullReason: string | null = "The confirmed brief has no rubric with a numeric scale.";
  if (revision.rubric) {
    const proposed = model.criteria.map((c) => ({ criterionId: c.criterionId, points: c.points, anchorQuote: c.anchorQuote, reason: c.reason ? checkReason(c.reason, sources) : null }));
    const scored = scoreRubric(revision.rubric, proposed);
    rubricEstimate = scored.estimate; rubricNullReason = scored.nullReason;
  }
  return {
    revisionId: revision.revisionId, eligibility, requirements, counts, rubricEstimate, rubricNullReason,
    whyFits: checkAll(model.whyFits, sources), whyNot: checkAll(model.whyNot, sources), stillUnknown: checkAll(model.stillUnknown, sources),
  };
}
