import { z } from "zod";
import { checkClaims, type Claim } from "@/lib/ai/claims";
export const claimSchema = z.object({ text: z.string().trim().min(1).max(1500), label: z.enum(["supported", "inferred", "unverified"]), sourceIds: z.array(z.string().min(1).max(128)).max(6) }).strict();
export const generatedSchema = z.object({ overlaps: z.array(claimSchema).max(6), differences: z.array(claimSchema).max(6), uncertainty: claimSchema }).strict();
export type Card = z.infer<typeof generatedSchema> & { projectId: string; url: string; title: string; excerpt: string };
export class EvidenceError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
export function groundClaims(claims: Claim[], projectId: string, excerpt: string): Claim[] {
  return checkClaims(claims, [projectId]).map((claim) => ({
    ...claim,
    label: claim.sourceIds.some((id) => id !== projectId) ||
      (claim.label === "supported" && (!claim.text.trim() || !excerpt.includes(claim.text))) ? "unverified" : claim.label,
    sourceIds: [...new Set(claim.sourceIds.filter((id) => id === projectId))],
  }));
}
