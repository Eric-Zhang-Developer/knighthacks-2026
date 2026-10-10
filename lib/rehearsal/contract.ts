import { createHash } from "node:crypto";
import { z } from "zod";
import type { Claim } from "@/lib/ai/claims";
import { groundClaim } from "@/lib/moment/contract";

export const MAX_WORDS = 90;
export const bodySchema = z.object({ built: z.array(z.string().trim().min(1).max(120)).min(1).max(8) }).strict();

const claim = z.object({ text: z.string().trim().min(1).max(300), label: z.enum(["supported", "inferred", "unverified"]),
  sourceIds: z.array(z.string().max(128)).max(6) }).strict();
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
// Exactly three questions and a pitch within 90 words: anything else fails, so generate() retries once, then gives up.
export const rehearsalSchema = z.object({
  pitch: z.array(z.object({ text: z.string().trim().min(1).max(600), status: z.enum(["built", "planned"]) }).strict()).min(1).max(8)
    .refine((p) => words(p.map((s) => s.text).join(" ")) <= MAX_WORDS, `at most ${MAX_WORDS} words`),
  questions: z.array(z.object({ question: z.string().trim().min(1).max(160), weakness: z.string().trim().min(1).max(160), basis: claim }).strict()).length(3),
}).strict();

export type Rehearsal = { versionId: string; built: string[]; pitch: { text: string; status: "built" | "planned" }[];
  questions: { question: string; weakness: string; basis: Claim }[] };
export class RehearsalError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

// Order doesn't change what was built, so the same items in any order are the same rehearsal.
export const builtHash = (built: string[]) => createHash("sha256").update(JSON.stringify([...built].sort())).digest("hex");

// A sentence is `built` only when it quotes a built item verbatim; the model can only lose that status here, never gain
// it, so a planned feature is never described as working (V3 F18).
export const pitchStatus = (text: string, status: "built" | "planned", built: string[]) =>
  status === "built" && built.some((b) => text.includes(b)) ? "built" : "planned";

export function ground(output: z.infer<typeof rehearsalSchema>, versionId: string, fields: (string | null)[], built: string[]): Rehearsal {
  return { versionId, built,
    pitch: output.pitch.map((s) => ({ text: s.text, status: pitchStatus(s.text, s.status, built) })),
    // `supported` only when the basis quotes a version field or a built item verbatim (both belong to this version).
    questions: output.questions.map((q) => ({ ...q, basis: groundClaim(q.basis, versionId, [...fields, ...built]) })) };
}
