import { z } from "zod";
import { checkClaims } from "@/lib/ai/claims";

export class DecisionError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

// The team's voluntarily shared profile. Empty or null means unknown, never "none" or zero.
const entries = z.array(z.string().trim().min(1).max(80)).max(12);
export const profileSchema = z.object({
  interests: entries,
  skills: entries,
  hardware: entries,
  hoursLeft: z.number().min(0.25).max(72).nullable(),
  teamSize: z.number().int().min(1).max(20).nullable(),
  enthusiasm: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).nullable(),
}).strict();
export type Profile = z.infer<typeof profileSchema>;
export const UNKNOWN: Profile = { interests: [], skills: [], hardware: [], hoursLeft: null, teamSize: null, enthusiasm: null };
export const putSchema = z.object({ expectedRevision: z.number().int().min(0), profile: profileSchema }).strict();
export const recommendSchema = z.object({ profileRevision: z.number().int().min(0) }).strict();
export const SCOPES = ["core", "optional", "later"] as const;
export type Scope = (typeof SCOPES)[number];
export const selectSchema = z.object({
  recommendationId: z.uuid(),
  expectedSelectionRevision: z.number().int().min(0),
  choices: z.array(z.object({ featureId: z.uuid(), scope: z.enum(SCOPES) }).strict()).min(1).max(8),
}).strict();

const provenance = { label: z.enum(["supported", "inferred", "unverified"]), sourceIds: z.array(z.string().min(1).max(128)).max(6) };
const claim = (max: number) => z.object({ text: z.string().trim().min(1).max(max), ...provenance }).strict();
export type Claim = { text: string; label: "supported" | "inferred" | "unverified"; sourceIds: string[] };
const named = z.array(z.string().trim().min(1).max(80)).max(6);
// What the model proposes: candidates and what each needs. It never sets a scope; assess() does.
export const generatedSchema = z.object({
  features: z.array(z.object({
    title: claim(120),
    demoStep: claim(400),
    reason: claim(400),
    requirements: z.object({ skills: named, hardware: named, hours: z.number().min(0.25).max(72).nullable() }).strict(),
  }).strict()).min(1).max(8),
}).strict();
export type Candidate = z.infer<typeof generatedSchema>["features"][number];

export type Influence = { field: keyof Profile; value: string | number | string[]; tradeoff: string };
export type Feature = {
  id: string;
  title: Claim;
  demoStep: Claim;
  reason: Claim;
  recommendedScope: Scope;
  profileInfluences: Influence[];
  requirements: Candidate["requirements"];
  gaps: Claim[]; // what couldn't be checked because the profile doesn't say
};

// Recommendations are deductions: a supported label survives only for an exact quote from a cited stored source, and
// a source id the retrieval didn't return is dropped.
export function ground(c: Claim, sources: Map<string, string[]>): Claim {
  const checked = checkClaims([c], sources.keys())[0];
  const ids = [...new Set(c.sourceIds.filter((id) => sources.has(id)))];
  const quoted = ids.some((id) => sources.get(id)!.some((s) => s.includes(c.text)));
  return { text: c.text, label: checked.label === "supported" && !quoted ? "inferred" : checked.label, sourceIds: ids };
}

const norm = (s: string) => s.trim().toLowerCase();
// "React" matches "react" or "React Native"; matching is loose on purpose, and every match is shown as an influence.
const has = (pool: string[], need: string) => pool.some((p) => norm(p).includes(norm(need)) || norm(need).includes(norm(p)));
const list = (xs: string[]) => xs.join(", ");
const gap = (text: string): Claim => ({ text, label: "unverified", sourceIds: [] });
const hours = (h: number) => `${Number(h.toFixed(2))} h`;

// Application code, not the model, decides each scope from the candidates' requirements and the saved profile, in
// recommendation order, so the same candidates and profile always give the same scopes. Unknown inputs never exclude
// a feature: they leave it as it was and say what wasn't checked.
export function assess(candidates: (Omit<Feature, "recommendedScope" | "profileInfluences" | "gaps">)[], profile: Profile): Feature[] {
  let used = 0;
  let cores = 0;
  return candidates.map((c) => {
    const influences: Influence[] = [];
    const gaps: Claim[] = [];
    let scope: Scope = "core";
    const { skills, hardware, hours: need } = c.requirements;

    if (hardware.length) {
      const missing = hardware.filter((h) => !has(profile.hardware, h));
      if (!profile.hardware.length) gaps.push(gap(`Needs ${list(hardware)}; the team hasn't listed its hardware, so this wasn't checked.`));
      else if (missing.length) {
        scope = "later";
        influences.push({ field: "hardware", value: profile.hardware, tradeoff: `Needs ${list(missing)}, which isn't in the team's hardware, so it's later unless one turns up.` });
      } else influences.push({ field: "hardware", value: profile.hardware, tradeoff: `The team has ${list(hardware)}, so the device isn't a blocker.` });
    }

    if (skills.length) {
      const missing = skills.filter((s) => !has(profile.skills, s));
      if (!profile.skills.length) gaps.push(gap(`Needs ${list(skills)}; the team hasn't listed its skills, so this wasn't checked.`));
      else if (missing.length) {
        if (scope === "core") scope = "optional";
        influences.push({ field: "skills", value: profile.skills, tradeoff: `Needs ${list(missing)}, which isn't among the team's skills, so it's not core: a gap there can't sink the demo.` });
      } else influences.push({ field: "skills", value: profile.skills, tradeoff: `The team's skills cover ${list(skills)}.` });
    }

    if (need !== null) {
      const left = profile.hoursLeft;
      if (left === null) gaps.push(gap(`Estimated at ${hours(need)}; time left isn't known, so it wasn't checked against the deadline.`));
      else if (need > left) {
        scope = "later";
        influences.push({ field: "hoursLeft", value: left, tradeoff: `Needs about ${hours(need)}, more than the ${hours(left)} left.` });
      } else if (scope === "core" && used + need > left) {
        scope = "optional";
        influences.push({ field: "hoursLeft", value: left, tradeoff: `Fits alone (${hours(need)}), but with the core items before it (${hours(used)}) it would pass the ${hours(left)} left.` });
      } else if (scope === "core") {
        used += need;
        influences.push({ field: "hoursLeft", value: left, tradeoff: `Fits: ${hours(need)}, ${hours(used)} of the ${hours(left)} left used by core items so far.` });
      }
    }

    if (profile.enthusiasm !== null && profile.enthusiasm <= 2 && scope === "core") {
      if (cores >= 2) {
        scope = "optional";
        influences.push({ field: "enthusiasm", value: profile.enthusiasm, tradeoff: `Enthusiasm ${profile.enthusiasm}/5: the core stays at two items so it gets finished.` });
      }
    }

    const text = norm([c.title.text, c.demoStep.text, c.reason.text].join(" "));
    const liked = profile.interests.filter((i) => text.includes(norm(i)));
    if (liked.length) influences.push({ field: "interests", value: liked, tradeoff: `Matches the team's interest in ${list(liked)}; the scope is set by the checks above.` });

    if (scope === "core") cores++;
    return { ...c, recommendedScope: scope, profileInfluences: influences, gaps };
  });
}

// The demo sketch is the selected core items' saved demo steps, in recommendation order.
export const sketch = (features: Pick<Feature, "id" | "demoStep">[], choices: Map<string, Scope>) =>
  features.filter((f) => choices.get(f.id) === "core").map((f) => f.demoStep);
