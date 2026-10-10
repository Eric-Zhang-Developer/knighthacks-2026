import { z } from "zod";
export const FIELDS = ["audience", "problem", "workflow", "constraints"] as const;
export const suggestionsSchema = z.object({
  suggestions: z.array(z.object({
    field: z.enum(FIELDS),
    change: z.string().min(1).max(4000),
    reason: z.string().min(1).max(1000),
  }).strict()).max(3),
}).strict();
export const proposeSchema = z.object({ versionId: z.uuid(), context: z.string().max(4000).optional() }).strict();
export const uuid = z.uuid();
export type Suggestion = z.infer<typeof suggestionsSchema>["suggestions"][number] & { id: string };
