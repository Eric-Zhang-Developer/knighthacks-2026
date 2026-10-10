import { z } from "zod";
import { checkClaims, type Claim } from "@/lib/ai/claims";

const text = z.string().trim().min(1).max(160);
const claim = z.object({ text, label: z.enum(["supported", "inferred", "unverified"]), sourceIds: z.array(z.string().max(128)).max(6) }).strict();
// Exactly three complete steps: a missing part or a wrong count fails, so generate() retries once and then gives up.
export const momentSchema = z.object({
  steps: z.array(z.object({ judgeDoes: text, appears: text, demonstrates: claim }).strict()).length(3),
  basis: z.array(claim).min(1).max(4),
}).strict();
export type Moment = { versionId: string; steps: { judgeDoes: string; appears: string; demonstrates: Claim }[]; basis: Claim[] };
export class MomentError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

// checkClaims checks source IDs, not text, so a claim is `supported` only when it quotes one of the version's own
// fields verbatim; a supported label without that quote becomes `inferred`. The version is the only valid source.
export function groundClaim(c: Claim, versionId: string, fields: (string | null)[]): Claim {
  const quoted = fields.some((f) => typeof f === "string" && f.includes(c.text));
  const label = c.label === "supported" && !quoted ? "inferred" : c.label;
  const sourceIds = label === "supported" ? [versionId] : c.sourceIds.filter((id) => id === versionId);
  return checkClaims([{ ...c, label, sourceIds }], [versionId])[0];
}
