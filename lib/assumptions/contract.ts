import { z } from "zod";
import { claimSchema } from "@/lib/evidence/contract";
import type { Claim } from "@/lib/ai/claims";

export const KINDS = ["need", "data", "feasibility", "differentiation"] as const;
export type Kind = (typeof KINDS)[number];
export type Reversal = { observe: string; reversesIf: string };
export type Item = { kind: Kind; assumption: Claim; reversal: Reversal | null; insufficient: boolean };
export type Assumptions = { versionId: string; assumptions: Item[] };

export const MAX_ITEMS = 6;
export const MAX_PER_KIND = 2;

// Falsifiability can't be machine-checked; this rejects the structure we can see is wrong: a blank part, or one
// that is only a hedge.
const HEDGES = new Set(["maybe", "possibly", "it depends", "unclear"]);
const isHedge = (s: string) => HEDGES.has(s.toLowerCase().replace(/[^a-z ]/g, "").trim());
export const validReversal = (r: Reversal) => [r.observe, r.reversesIf].every((part) => part.trim() && !isHedge(part));

// Exactly one of a usable reversal or `insufficient` (V3 F23): never both, never neither.
export function wellFormed(item: { reversal: Reversal | null; insufficient: boolean }): boolean {
  return item.insufficient ? item.reversal === null : item.reversal !== null && validReversal(item.reversal);
}

const text = (max: number) => z.string().max(max);
const itemSchema = z.object({
  kind: z.enum(KINDS),
  assumption: claimSchema,
  reversal: z.object({ observe: text(1000), reversesIf: text(1000) }).strict().nullable(),
  insufficient: z.boolean(),
}).strict();

// The model's output. The first attempt rejects any malformed item, so `generate` regenerates once; the second
// attempt keeps the well-formed items and drops the rest. Build one schema per generation: it counts attempts.
export function generatedSchema() {
  let attempt = 0;
  return z.object({ assumptions: z.array(itemSchema).max(12) }).strict()
    .superRefine((out, ctx) => {
      attempt++;
      if (attempt === 1 && out.assumptions.some((i) => !wellFormed(i))) {
        ctx.addIssue({ code: "custom", message: "Each assumption needs a concrete reversal or insufficient: true, never both" });
      }
    })
    .transform((out) => ({ assumptions: out.assumptions.filter(wellFormed) }));
}

// At most 6, at most 2 per kind, in the model's order.
export function cap<T extends { kind: Kind }>(items: T[]): T[] {
  const seen = new Map<Kind, number>();
  return items.filter((i) => {
    const n = seen.get(i.kind) ?? 0;
    seen.set(i.kind, n + 1);
    return n < MAX_PER_KIND;
  }).slice(0, MAX_ITEMS);
}

// An assumption may cite only the version's evidence-card projects; "supported" must quote a cited card's excerpt.
// Anything else keeps its sources it can and becomes unverified.
export function groundAssumption(claim: Claim, cards: { projectId: string; excerpt: string }[]): Claim {
  const known = new Map(cards.map((c) => [c.projectId, c.excerpt]));
  const sourceIds = [...new Set(claim.sourceIds.filter((id) => known.has(id)))];
  const foreign = claim.sourceIds.some((id) => !known.has(id));
  const quoted = sourceIds.length > 0 && sourceIds.some((id) => known.get(id)!.includes(claim.text));
  const label = foreign || (claim.label === "supported" && !quoted) ? "unverified" : claim.label;
  return { text: claim.text, label, sourceIds };
}

export class AssumptionsError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
