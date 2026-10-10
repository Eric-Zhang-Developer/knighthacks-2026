import { z } from "zod";
import { fieldsSchema } from "@/lib/ideas/contract";

export const FIELDS = ["audience", "problem", "workflow", "constraints", "data", "demo"] as const;
export const MAX_QUESTIONS = 3;
// ponytail: rounds are counted by answers, 3 rounds × 3 questions; a round with fewer questions allows more rounds, up
// to 9 answers. Send a round number from the client if that ceiling ever matters.
export const MAX_ANSWERS = 9;

const answer = z.object({ question: z.string().trim().min(1).max(300), field: z.enum(FIELDS), answer: z.string().trim().min(1).max(2000) }).strict();
export const requestSchema = z.object({ fields: fieldsSchema, answers: z.array(answer).max(MAX_ANSWERS) }).strict();
export const outputSchema = z.object({
  questions: z.array(z.object({ field: z.enum(FIELDS), question: z.string().trim().min(1).max(200), why: z.string().trim().min(1).max(200) }).strict())
    .max(FIELDS.length), // extras are trimmed by settle(), not a reason to fail the call
  done: z.boolean(),
}).strict();
export type Interview = z.infer<typeof outputSchema>;

export class InterviewError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

// The model proposes; the server keeps the answer consistent: done means no questions, no questions means done, and
// at most one question per field, in the model's order of importance.
export function settle(out: Interview): Interview {
  const seen = new Set<string>();
  const questions = out.questions.filter((q) => !seen.has(q.field) && seen.add(q.field)).slice(0, MAX_QUESTIONS);
  return out.done || questions.length === 0 ? { questions: [], done: true } : { questions, done: false };
}
