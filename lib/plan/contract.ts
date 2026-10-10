import { z } from "zod";
import { checkClaims } from "@/lib/ai/claims";

export const inputSchema = z.object({
  hoursLeft: z.number().min(2).max(72),
  teamSize: z.number().int().min(1).max(20).default(2),
  skills: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
}).strict();
export type PlanInput = z.infer<typeof inputSchema>;
const text = z.string().trim().min(1).max(400);
const provenance = { label: z.enum(["supported", "inferred", "unverified"]),
  sourceIds: z.array(z.string().min(1).max(128)).max(6) };
const item = z.object({ text, ...provenance }).strict();
const planSchema = z.object({
  tour: z.array(item).min(1).max(6),
  cut: z.array(item).max(8),
  timeline: z.array(z.object({ hour: z.number().min(0), goal: text, ...provenance }).strict()).min(2).max(12),
  risks: z.array(z.object({ risk: text, countermeasure: text, ...provenance }).strict()).min(1).max(6),
}).strict();
export type Plan = z.infer<typeof planSchema>;
export class PlanError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
export function outputSchema(hoursLeft: number) {
  return planSchema.superRefine((p, ctx) => {
    const last = p.timeline.at(-1)!;
    if (last.goal !== "Code freeze" || last.hour > hoursLeft - 1 ||
      p.timeline.some((t, i) => i > 0 && t.hour <= p.timeline[i - 1].hour)) {
      ctx.addIssue({ code: "custom", message: "Use increasing hours; end with Code freeze at least one hour before the deadline" });
    }
  });
}

// Recommendations are deductions. A supported label survives only for exact quotations from the supplied stored sources.
export function ground(plan: Plan, sources: Map<string, string[]>): Plan {
  function item<T extends { label: "supported" | "inferred" | "unverified"; sourceIds: string[] }>(value: T, texts: string[]): T {
    const checked = checkClaims([{ text: texts.join(" "), ...value }], sources.keys())[0];
    const ids = [...new Set(value.sourceIds.filter((id) => sources.has(id)))];
    const quoted = texts.every((t) => ids.some((id) => sources.get(id)!.some((s) => s.includes(t))));
    const label = checked.label === "supported" && !quoted ? "inferred" : checked.label;
    return { ...value, label, sourceIds: ids };
  }
  return { tour: plan.tour.map((v) => item(v, [v.text])), cut: plan.cut.map((v) => item(v, [v.text])),
    timeline: plan.timeline.map((v) => item(v, [v.goal])), risks: plan.risks.map((v) => item(v, [v.risk, v.countermeasure])) };
}
