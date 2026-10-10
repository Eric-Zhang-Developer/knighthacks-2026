import { z } from "zod";
import type { Claim } from "@/lib/ai/claims";

// specs/context/event.md: every project is scored 1 to 5 on these five, each on its own (no total, no win chance).
export const CRITERIA = [
  { key: "originality", name: "Originality" },
  { key: "technicalUnderstanding", name: "Technical Understanding" },
  { key: "functionality", name: "Functionality" },
  { key: "design", name: "Design" },
  { key: "wowFactor", name: "Wow Factor" },
] as const;
export const INSUFFICIENT = "evidence is insufficient";

const point = z.object({ text: z.string().trim().min(1).max(300), label: z.enum(["supported", "inferred", "unverified"]),
  sourceIds: z.array(z.string().max(128)).max(4) }).strict();
const criterion = z.object({ score: z.number().int().min(1).max(5).nullable(), for: z.array(point).max(4), against: z.array(point).max(4) }).strict();
// Keyed by criterion, so all five are always present.
export const outputSchema = z.object(Object.fromEntries(CRITERIA.map((c) => [c.key, criterion])) as Record<(typeof CRITERIA)[number]["key"], typeof criterion>).strict();

export type Criterion = { criterion: string; score: number | null; for: Claim[]; against: Claim[]; label: "supported" | "inferred"; note: string | null };
export type Scorecard = { id: string; versionId: string; criteria: Criterion[]; sources: { projectId: string; title: string; url: string }[]; createdAt: string };
export class ScorecardError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

// A point keeps only sources that are this version's evidence cards; it is `supported` only when it cites one.
const ground = (p: Claim, known: Set<string>): Claim => {
  const sourceIds = [...new Set(p.sourceIds.filter((id) => known.has(id)))];
  return { text: p.text, sourceIds, label: p.label === "unverified" ? "unverified" : sourceIds.length ? "supported" : "inferred" };
};

export function settle(out: z.infer<typeof outputSchema>, known: Set<string>): Criterion[] {
  return CRITERIA.map(({ key, name }) => {
    const c = out[key];
    // Originality rests on the real neighbours: a point that cites none (empty map space, say) is no reason.
    const keep = (points: Claim[]) => points.map((p) => ground(p, known)).filter((p) => key !== "originality" || p.sourceIds.length > 0);
    const pro = keep(c.for), con = keep(c.against);
    const thin = c.score === null || pro.length === 0 || con.length === 0;
    const all = [...pro, ...con];
    return { criterion: name, score: thin ? null : c.score, for: pro, against: con, note: thin ? INSUFFICIENT : null,
      label: all.length > 0 && all.every((p) => p.sourceIds.length > 0) ? "supported" : "inferred" };
  });
}
