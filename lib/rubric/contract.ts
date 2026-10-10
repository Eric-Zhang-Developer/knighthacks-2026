import { z } from "zod";
import { checkClaims, type Claim } from "@/lib/ai/claims";
import tracks from "./tracks.json";
export { tracks };
const claimSchema = z.object({ text: z.string().trim().min(1).max(500), label: z.enum(["supported", "inferred", "unverified"]), sourceIds: z.array(z.string().min(1).max(128)).max(3) }).strict();
export const proofSchema = z.object({ proof: z.string().trim().min(1).max(4000).nullable() }).strict();
export type TrackResult = { trackId: string; requirement: string | null; stated: Claim[]; speculative: Claim[]; proof: string | null };
export type Overlay = { versionId: string; tracks: TrackResult[] };
export class RubricError extends Error { constructor(readonly status: number, message: string) { super(message); } }
export function generatedSchema(fields: string[]) {
  const facts = [...fields, ...tracks.flatMap((track) => [track.name, ...(track.rewards ? [track.rewards] : [])])];
  return z.object({ tracks: z.array(z.object({ trackId: z.enum(tracks.map((track) => track.id) as [string, ...string[]]), stated: z.array(claimSchema).max(1), speculative: z.array(claimSchema).max(1) }).strict()).length(tracks.length) }).strict().superRefine((value, ctx) => {
    if (new Set(value.tracks.map((track) => track.trackId)).size !== tracks.length) ctx.addIssue({ code: "custom", message: "Include each catalog track exactly once" });
    for (const track of value.tracks) for (const claim of [...track.stated, ...track.speculative]) {
      // Exact source quotations are factual input, not a generated score. Inspect all remaining prose.
      const quoted = claim.text.replace(/"([^"\n]+)"|“([^”\n]+)”/gu, (span, straight: string | undefined, curly: string | undefined) => facts.some((fact) => fact.includes(straight ?? curly ?? "")) ? " " : span);
      const remainder = facts.some((fact) => fact.includes(claim.text)) ? "" : facts.filter(Boolean).sort((a, b) => b.length - a.length).reduce((text, fact) => text.split(fact).join(" "), quoted);
      const predicts = /\b(scores?|scored|scoring|rank(?:s|ed|ing)?|ratings?|odds|probabilit(?:y|ies)|percent(?:age)?)\b|\bchance\b.{0,40}\bwin|\b(?:will|likely|unlikely|certain|guaranteed|expect(?:ed)?)\b.{0,30}\bwin|\bwin(?:ning)?\b.{0,30}\b(?:chance|likelihood|estimate)\b|\d\s*%/iu.test(remainder);
      const unknownNumber = /\p{N}/u.test(remainder);
      if (predicts || unknownNumber) ctx.addIssue({ code: "custom", message: "Do not generate scores, rankings, winning estimates or unsupported numbers" });
    }
  });
}
export function normalize(versionId: string, fields: string[], generated: z.infer<ReturnType<typeof generatedSchema>>): Overlay {
  return { versionId, tracks: tracks.map((track) => {
    const value = generated.tracks.find((entry) => entry.trackId === track.id)!;
    const stated: Claim[] = [], speculative: Claim[] = [];
    for (const original of value.stated) {
      if (fields.some((field) => field.includes(original.text))) stated.push(checkClaims([{ ...original, label: "supported", sourceIds: [versionId] }], [versionId])[0]);
      else speculative.push({ ...checkClaims([original], [versionId])[0], label: "unverified", sourceIds: [] });
    }
    for (const original of value.speculative) {
      const checked = checkClaims([original], [versionId])[0];
      speculative.push({ ...checked, label: checked.label === "supported" ? "inferred" : checked.label, sourceIds: checked.sourceIds.filter((id) => id === versionId) });
    }
    return { trackId: track.id, requirement: track.rewards, stated, speculative, proof: null };
  }) };
}


