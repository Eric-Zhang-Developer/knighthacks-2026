import { z } from "zod";
import { fieldsSchema } from "@/lib/ideas/contract";
import { FIELDS } from "@/lib/revisions/contract";

export const suggestSchema = z.object({ versionId: z.uuid() }).strict();
export const directionsSchema = z.object({ directions: z.array(z.object({
  title: z.string().trim().min(1).max(200),
  field: z.enum(FIELDS),
  change: z.string().trim().min(1).max(4000),
}).strict()).max(3) }).strict();
export const manualSchema = z.object({
  versionId: z.uuid(),
  fields: fieldsSchema.partial().refine((fields) => Object.keys(fields).length > 0, "Provide an edit"),
}).strict();
