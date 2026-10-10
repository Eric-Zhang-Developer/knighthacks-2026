import { z } from "zod";
import { checkClaims, type Claim } from "@/lib/ai/claims";
const nonblank = (max: number) => z.string().trim().min(1).max(max);
export const startSchema = z.object({ versionId: z.uuid(), perspective: z.enum(["user", "judge", "engineer"]) }).strict();
export const answerSchema = z.object({ answer: nonblank(8000) }).strict();
export const outcomeSchema = z.object({ outcome: z.enum(["revise", "gather evidence", "test", "answered well"]) }).strict();
const claimSchema = z.object({ text: nonblank(2000), label: z.enum(["supported", "inferred", "unverified"]), sourceIds: z.array(nonblank(128)).max(5) }).strict();
export type Source = { id: string; excerpt: string };
export function questionSchema(sources: Source[]) {
  const known = new Map(sources.map((s) => [s.id, s.excerpt]));
  return z.object({ question: nonblank(2000), assumption: nonblank(1000), source: claimSchema, test: nonblank(2000).nullable() }).strict().superRefine((value, ctx) => {
    const ids = value.source.sourceIds;
    if (ids.some((id) => !known.has(id)) || (!ids.length && !value.test) ||
      (ids.length > 0 && value.source.label === "supported" && !ids.every((id) => known.get(id)!.includes(value.source.text)))) {
      ctx.addIssue({ code: "custom", message: "Name a real supplied source with a valid quote, or an explicit proposed test without citations" });
    }
  });
}
export function groundedSource(source: Claim, test: string | null, sources: Source[]): Claim {
  const checked = checkClaims([source], sources.map((s) => s.id))[0];
  return checked.sourceIds.length ? checked : { text: `Proposed test: ${test}`, label: "unverified", sourceIds: [] };
}
export class ChallengeError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
