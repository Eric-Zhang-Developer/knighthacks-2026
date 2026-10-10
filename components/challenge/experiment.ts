// Shapes from prove-it-api (lib/experiments/). A result is null until the user records one: "not run".
import type { Claim } from "./rounds";

export const RESULTS = ["confirmed", "refuted", "inconclusive"] as const;
export type Result = (typeof RESULTS)[number];
export type Experiment = {
  id: string;
  sessionId: string;
  round: number;
  assumption: string;
  hypothesis: Claim;
  procedure: string;
  observable: string;
  result: Result | null;
  note: string | null;
};
export type Draft = { hypothesis: string; procedure: string; observable: string };

export const resultText = (r: Result | null) => (r ? r[0].toUpperCase() + r.slice(1) : "Not run");

// Only the parts the user changed go in the PATCH; the API refuses an empty one.
export function changedParts(e: Experiment, d: Draft): Partial<Draft> {
  const now: Draft = { hypothesis: e.hypothesis.text, procedure: e.procedure, observable: e.observable };
  return Object.fromEntries(
    (Object.keys(d) as (keyof Draft)[]).filter((k) => d[k].trim() && d[k].trim() !== now[k]).map((k) => [k, d[k].trim()]),
  );
}

export const findFor = (list: Experiment[], sessionId: string | null, round: number) =>
  list.find((e) => e.sessionId === sessionId && e.round === round);
