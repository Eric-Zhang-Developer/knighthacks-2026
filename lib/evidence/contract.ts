import { z } from "zod";
import { checkClaims, type Claim } from "@/lib/ai/claims";
export const claimSchema = z.object({ text: z.string().trim().min(1).max(1500), label: z.enum(["supported", "inferred", "unverified"]), sourceIds: z.array(z.string().min(1).max(128)).max(6) }).strict();
export const generatedSchema = z.object({ overlaps: z.array(claimSchema).max(6), differences: z.array(claimSchema).max(6), uncertainty: claimSchema }).strict();
// excerptSource: which project field the stored excerpt came from, matched against the project's current text when
// the card is read; "unknown" when it no longer matches anything (the project changed or left the corpus).
export type ExcerptSource = "description" | "tagline" | "title" | "unknown";
export type Card = z.infer<typeof generatedSchema> & { projectId: string; url: string; title: string; excerpt: string; excerptSource: ExcerptSource };

// A project with no description on record is only a gallery card: its title and tagline. Sources the model reads say
// so, and the instructions forbid claims about how it works beyond that text. Full projects' prompts are unchanged.
export const GALLERY_CARD = "Gallery card only: this project has a title and tagline on record but no description.";
export const GALLERY_RULE = " A source marked galleryCardOnly is a title and tagline, not a write-up: claim nothing about how that project works beyond its text.";
export const summaryOnly = (description: unknown) => typeof description !== "string" || !description.trim();
export const galleryCard = (description: unknown) => (summaryOnly(description) ? { galleryCardOnly: true, note: GALLERY_CARD } : {});
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
