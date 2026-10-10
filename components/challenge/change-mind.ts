// Shapes from change-mind-api (lib/assumptions/contract.ts).
import type { Claim } from "./rounds";

export const KINDS = ["need", "data", "feasibility", "differentiation"] as const;
export type Kind = (typeof KINDS)[number];
export type Assumption = { kind: Kind; assumption: Claim; reversal: { observe: string; reversesIf: string } | null; insufficient: boolean };

const KIND_TEXT: Record<Kind, string> = { need: "Need", data: "Data", feasibility: "Feasibility", differentiation: "Differentiation" };
export const kindText = (k: Kind) => KIND_TEXT[k];

// Grouped by kind in a fixed order; kinds with nothing are left out.
export function byKind(items: Assumption[]): [Kind, Assumption[]][] {
  return KINDS.map((k) => [k, items.filter((i) => i.kind === k)] as [Kind, Assumption[]]).filter(([, list]) => list.length > 0);
}
