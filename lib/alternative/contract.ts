import { z } from "zod";
import { claimSchema } from "@/lib/evidence/contract";
import type { Claim } from "@/lib/ai/claims";
export type Alternative = { versionId: string; projectId: string; url: string; title: string; points: { step: string; claim: Claim }[]; missingWorkflow: boolean };
export function comparisonSchema(workflow: string) {
  return z.object({ points: z.array(z.object({ step: z.string().trim().min(1).max(1000), claim: claimSchema }).strict()).min(2).max(4) }).strict()
    .superRefine((result, ctx) => {
      if (result.points.some((point) => !workflow.includes(point.step))) ctx.addIssue({ code: "custom", message: "Each step must quote an actual action phrase from the saved workflow" });
    });
}
export class AlternativeError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
