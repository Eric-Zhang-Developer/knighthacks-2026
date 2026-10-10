import { z } from "zod";
import { claimSchema } from "@/lib/evidence/contract";
// The names come from specs/context/event.md; functionality includes remaining-time feasibility.
export const CRITERIA = ["Originality", "Technical Understanding", "Functionality", "Design", "Wow Factor"] as const;
export const requestSchema = z.object({ versionIds: z.array(z.uuid().toLowerCase()).min(2).max(3)
  .refine((ids) => new Set(ids).size === ids.length, "Choose distinct versions") }).strict();
const prose = z.string().trim().min(1).max(1500).regex(/^[^\p{N}]*$/u, "Use qualitative prose, not numbers");
export const resultSchema = z.object({ criteria: z.array(z.object({
  name: z.enum(CRITERIA),
  perVersion: z.array(z.object({ versionId: z.uuid(), reason: claimSchema.extend({ text: prose }), uncertainty: prose }).strict()).min(2).max(3),
}).strict()).length(CRITERIA.length) }).strict();
