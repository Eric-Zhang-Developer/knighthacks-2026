import { z } from "zod";
export const fieldsSchema = z.object({
  title: z.string().max(200).nullable(),
  description: z.string().max(4000).nullable(),
  audience: z.string().max(4000).nullable(),
  problem: z.string().max(4000).nullable(),
  workflow: z.string().max(4000).nullable(),
  constraints: z.string().max(4000).nullable(),
}).strict();
export type IdeaFields = z.infer<typeof fieldsSchema>;
export const saveSchema = fieldsSchema.refine((fields) => Object.values(fields).some((value) => value?.trim()), "An idea needs some text");
export const interpretSchema = z.object({ text: z.string().min(1).max(8000).refine((text) => Boolean(text.trim())) }).strict();
export class IdeaError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
export type IdeaVersion = IdeaFields & {
  ideaId: string; versionId: string; parentId: string | null;
  x: number; y: number; z: number; neighborIds: string[]; corpusVersion: string; createdAt: string;
};
