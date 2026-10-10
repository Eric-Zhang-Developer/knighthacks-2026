import { z } from "zod";
import { fieldsSchema } from "@/lib/ideas/contract";
import { claim } from "./contracts";
const generatedSchema = z.object({ overlaps: z.array(claim), differences: z.array(claim), uncertainty: claim });
export const CRITERIA = ["Originality", "Technical Understanding", "Functionality", "Design", "Wow Factor"] as const;
const prose = z.string().trim().min(1).regex(/^[^\p{N}]*$/u);
export const resultSchema = z.object({ criteria: z.array(z.object({ name: z.enum(CRITERIA), perVersion: z.array(z.object({ versionId: z.uuid(), reason: claim.extend({ text: prose }), uncertainty: prose }).strict()).length(2) }).strict()).length(5) }).strict();
export const versionSchema = fieldsSchema.extend({ versionId: z.uuid(), ideaId: z.uuid(), parentId: z.uuid().nullable(), neighborIds: z.array(z.string()).length(5), corpusVersion: z.string(), createdAt: z.string(), x: z.number(), y: z.number(), z: z.number() });
export const cardSchema = generatedSchema.extend({ projectId: z.string(), excerpt: z.string().min(1), title: z.string(), url: z.url() });
export const cardsSchema = z.object({ cards: z.array(cardSchema) });
export const suggestions = z.object({ suggestions: z.array(z.object({ id: z.uuid(), field: z.string(), change: z.string().min(1), reason: z.string().min(1) })).min(1).max(3) });
export const directions = z.object({ directions: z.array(z.object({ id: z.uuid(), title: z.string().min(1), change: z.string().min(1) })).min(1).max(3) });

