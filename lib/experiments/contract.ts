import { z } from "zod";
const nonblank = (max: number) => z.string().trim().min(1).max(max);
export const RESULTS = ["confirmed", "refuted", "inconclusive"] as const;
export const startSchema = z.object({ sessionId: z.uuid(), round: z.number().int().min(1).max(3) }).strict();
// What the model drafts. The procedure has to fit in ten minutes; the prompt says so and the length bounds keep it short.
export const draftSchema = z.object({ hypothesis: nonblank(1000), procedure: nonblank(2000), observable: nonblank(1000) }).strict();
// A PATCH either edits the three parts or records a result, never both: a result is about the experiment as it stood.
export const patchSchema = z.union([
  draftSchema.partial().strict().refine((v) => Object.keys(v).length > 0, "Nothing to change"),
  z.object({ result: z.enum(RESULTS), note: z.string().trim().max(2000).nullable().optional() }).strict(),
]);
export class ExperimentError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
