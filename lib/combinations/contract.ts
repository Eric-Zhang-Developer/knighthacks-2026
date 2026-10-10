import { z } from "zod";
import { checkClaims, type Claim } from "@/lib/ai/claims";
const text = (max: number) => z.string().trim().min(1).max(max);
const claimSchema = z.object({ text: text(1000), label: z.enum(["supported", "inferred", "unverified"]), sourceIds: z.array(text(128)).max(5) }).strict();
export const candidateSchema = z.object({ user: text(300), benefit: claimSchema, workflow: z.array(text(500)).min(1).max(6), sourceIds: z.array(text(128)).length(2), claims: z.array(claimSchema).max(6) }).strict();
// Invalid candidates become null independently; one malformed sibling must not discard a valid proposal.
export const generatedSchema = z.object({ suggestions: z.array(candidateSchema.nullable().catch(null)).max(3) }).strict();
export type Source = { projectId: string; title: string; url: string; excerpt: string };
export type Suggestion = { user: string; benefit: Claim; workflow: string[]; workflowIsProposal: true; sources: { projectId: string; title: string; url: string }[]; claims: Claim[] };
export type Combinations = { versionId: string; suggestions: Suggestion[] };
export class CombinationError extends Error { constructor(readonly status: number, message: string) { super(message); } }
function ground(original: Claim, pair: Source[]): Claim {
  const ids = pair.map((source) => source.projectId), checked = checkClaims([original], ids)[0];
  const foreign = checked.sourceIds.some((id) => !ids.includes(id));
  const quoted = checked.sourceIds.length > 0 && checked.sourceIds.every((id) => pair.find((source) => source.projectId === id)?.excerpt.includes(checked.text));
  return { ...checked, sourceIds: [...new Set(checked.sourceIds.filter((id) => ids.includes(id)))], label: foreign || (checked.label === "supported" && !quoted) ? "unverified" : checked.label };
}
export function normalize(versionId: string, candidates: unknown[], sources: Source[]): Combinations {
  const suggestions: Suggestion[] = [];
  for (const raw of candidates.slice(0, 3)) {
    const parsed = candidateSchema.safeParse(raw);
    if (!parsed.success) continue;
    const candidate = parsed.data;
    if (new Set(candidate.sourceIds).size !== 2) continue;
    const pair = candidate.sourceIds.map((id) => sources.find((source) => source.projectId === id));
    if (pair.some((source) => !source)) continue;
    // Proposed combinations are not already deployed products or predictions of prizes.
    const prose = [candidate.user, candidate.benefit.text, ...candidate.workflow, ...candidate.claims.map((claim) => claim.text)].join("\n");
    if (/\b(?:will|would|guaranteed to|certain to|likely to)\s+win\b|\b(?:chance|odds|probability)\b.{0,30}\bwin|\b(?:combination|combined (?:workflow|product|solution))\b.{0,30}\b(?:already|exists|deployed|available today)\b/iu.test(prose)) continue;
    const actual = pair as Source[];
    suggestions.push({ user: candidate.user, benefit: ground(candidate.benefit, actual), workflow: candidate.workflow, workflowIsProposal: true,
      sources: actual.map(({ projectId, title, url }) => ({ projectId, title, url })), claims: candidate.claims.map((claim) => ground(claim, actual)) });
  }
  return { versionId, suggestions };
}
