import { ChallengeError, type ConfirmInput, type Criterion, type CriterionEstimate, type Reason, type Rubric, type RubricEstimate } from "./contract";

// Rubric checks and arithmetic. Only the server adds points, only under a rule the confirmed brief states in words,
// and never by inventing a weight, counting missing evidence as zero or renormalising a partial rubric.

// A minus counts only where it can't be a range dash: "1-10" is 1 and 10, "-2" is minus two.
const NUMBER = /(?<![\d.,])-?\d+(?:[.,]\d+)?/g;
/** The numbers a text states, as values. "30%" states 30; "0,5" states 0.5. Nothing is evaluated. */
export const numbers = (text: string) => [...text.matchAll(NUMBER)].map((m) => Number(m[0].replace(",", ".")));
export function states(quote: string, value: number) {
  return numbers(quote).some((n) => Math.abs(n - value) < 1e-9);
}
function quoted(transcript: string, quote: string, what: string) {
  if (!transcript.includes(quote)) throw new ChallengeError(400, `${what} must quote the confirmed transcript exactly`);
}

/** Confirm-time: every scale, anchor, weight and rule quotes the transcript and states its own number. */
export function confirmRubric(transcript: string, input: ConfirmInput["rubric"]): Rubric | null {
  if (!input) return null;
  const criteria: Criterion[] = input.criteria.map((c, i) => {
    quoted(transcript, c.quote, "A criterion");
    if (c.scale) {
      quoted(transcript, c.scale.quote, "A scale");
      if (!(c.scale.min < c.scale.max) || !states(c.scale.quote, c.scale.min) || !states(c.scale.quote, c.scale.max))
        throw new ChallengeError(400, "A scale's quote must state its minimum and maximum, minimum below maximum");
    }
    const points = new Set<number>();
    for (const a of c.anchors) {
      quoted(transcript, a.quote, "An anchor");
      if (!states(a.quote, a.points)) throw new ChallengeError(400, "An anchor's quote must state its points");
      if (c.scale && (a.points < c.scale.min || a.points > c.scale.max)) throw new ChallengeError(400, "An anchor lies outside its scale");
      if (points.has(a.points)) throw new ChallengeError(400, "Two anchors give the same points");
      points.add(a.points);
    }
    let weight: Criterion["weight"] = null;
    if (c.weight) {
      quoted(transcript, c.weight.quote, "A weight");
      if (!states(c.weight.quote, c.weight.value)) throw new ChallengeError(400, "A weight's quote must state its value");
      if (c.weight.unit === "percent" && !new RegExp(`(?<![\\d.,])${String(c.weight.value).replace(".", "[.,]")}\\s*(?:%|percent)`, "i").test(c.weight.quote))
        throw new ChallengeError(400, "A percent weight's quote must say percent");
      // Percent converts to a decimal coefficient, visibly; nothing else is rescaled.
      weight = { ...c.weight, coefficient: c.weight.unit === "percent" ? c.weight.value / 100 : c.weight.value };
    }
    return { id: `c${i + 1}`, name: c.name, quote: c.quote, scale: c.scale, anchors: c.anchors.map((a) => ({ ...a })), weight };
  });
  for (const a of input.aggregation) quoted(transcript, a.quote, "An aggregation rule");
  return { criteria, aggregation: input.aggregation.map((a) => ({ ...a })) };
}

const round = (n: number) => Math.round(n * 1e9) / 1e9;

/**
 * Estimates from the model, already citation-checked (`reason` is null unless it cites applicable evidence).
 * Returns null when no criterion can be scored.
 */
export function scoreRubric(rubric: Rubric, proposed: { criterionId: string; points: number | null; anchorQuote: string | null; reason: Reason | null }[]): { estimate: RubricEstimate | null; nullReason: string | null } {
  const criteria: CriterionEstimate[] = rubric.criteria.map((c) => {
    const p = proposed.find((x) => x.criterionId === c.id);
    const none = (nullReason: string): CriterionEstimate => ({ criterionId: c.id, points: null, anchorQuote: null, reason: p?.reason ?? null, nullReason });
    if (!c.scale) return none("The confirmed brief gives no numeric scale for this criterion.");
    if (!c.anchors.length) return none("The confirmed brief gives no grading anchors for this criterion.");
    if (!p || p.points === null) return none("No applicable evidence to estimate this criterion.");
    const anchor = c.anchors.find((a) => a.points === p.points);
    if (!anchor || p.points < c.scale.min || p.points > c.scale.max) return none("The proposed points are not one of the brief's anchors; discarded.");
    if (p.anchorQuote !== anchor.quote) return none("The proposed anchor does not match the brief's anchor for those points; discarded.");
    if (!p.reason || !p.reason.citations.some((x) => x.source !== "brief")) return none("No cited evidence or idea passage supports this estimate.");
    return { criterionId: c.id, points: p.points, anchorQuote: anchor.quote, reason: p.reason, nullReason: null };
  });
  if (!criteria.some((c) => c.points !== null)) return { estimate: null, nullReason: "No criterion could be estimated from the confirmed rubric and the cited evidence." };
  const note = "Model-assessed estimate under the confirmed rubric: not a judge's score, a ranking or an eligibility certification." as const;
  const partial = (nullReason: string): { estimate: RubricEstimate; nullReason: null } => ({ estimate: { criteria, total: null, maximum: null, rule: null, nullReason, note }, nullReason: null });
  const rules = [...new Set(rubric.aggregation.map((a) => a.rule))];
  if (!rules.length) return partial("The confirmed brief states no rule for combining criteria, so no total is computed.");
  if (rules.length > 1) return partial("The confirmed brief states conflicting rules for combining criteria, so no total is computed.");
  const rule = rules[0];
  if (rule === "other") return partial("The brief's combining rule is not a stated sum or weighted sum; the app computes no other formula.");
  if (criteria.some((c) => c.points === null)) return partial("Not every criterion could be estimated; missing evidence is not counted as zero and the rubric is not renormalised.");
  if (rule === "weighted_sum" && rubric.criteria.some((c) => !c.weight)) return partial("The brief gives no weight for every criterion, so no weighted total is computed.");
  const coefficient = (c: Criterion) => (rule === "weighted_sum" ? c.weight!.coefficient : 1);
  const total = round(rubric.criteria.reduce((sum, c, i) => sum + coefficient(c) * criteria[i].points!, 0));
  const maximum = round(rubric.criteria.reduce((sum, c) => sum + coefficient(c) * c.scale!.max, 0));
  return { estimate: { criteria, total, maximum, rule, nullReason: null, note }, nullReason: null };
}
