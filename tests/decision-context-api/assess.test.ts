import { expect, test, vi } from "vitest";
vi.mock("next/dist/compiled/server-only", () => ({}));
import type { Profile } from "@/lib/decision-context/contract";
const { assess, ground, sketch, UNKNOWN, profileSchema } = await import("@/lib/decision-context/contract");

const claim = (text: string) => ({ text, label: "inferred" as const, sourceIds: [] });
const candidates = [
  { id: "f1", title: claim("Sensor dashboard"), demoStep: claim("Show live readings"), reason: claim("Core value"), requirements: { skills: ["React"], hardware: ["Raspberry Pi"], hours: 3 } },
  { id: "f2", title: claim("Alerts"), demoStep: claim("Trigger an alert"), reason: claim("Closes the loop"), requirements: { skills: ["Python"], hardware: [], hours: 2 } },
  { id: "f3", title: claim("History charts"), demoStep: claim("Scroll back a day"), reason: claim("Context"), requirements: { skills: [], hardware: [], hours: 4 } },
];
const team: Profile = { interests: ["climate"], skills: ["React", "Python"], hardware: ["Raspberry Pi 4"], hoursLeft: 10, teamSize: 3, enthusiasm: 4 };
const scopes = (p: Profile) => assess(candidates, p).map((f) => f.recommendedScope);

test("the same candidates and profile always give the same scopes", () => {
  expect(assess(candidates, team)).toEqual(assess(candidates, team));
  expect(scopes(team)).toEqual(["core", "core", "core"]);
});

test("less known time changes an affected scope, and says why", () => {
  const short = { ...team, hoursLeft: 3.5 };
  expect(scopes(short)).toEqual(["core", "optional", "later"]); // 3 h fits; +2 h passes 3.5; 4 h alone is too long
  const [, f2, f3] = assess(candidates, short);
  expect(f2.profileInfluences).toContainEqual({ field: "hoursLeft", value: 3.5, tradeoff: expect.stringContaining("pass the 3.5 h left") });
  expect(f3.profileInfluences).toContainEqual({ field: "hoursLeft", value: 3.5, tradeoff: expect.stringContaining("more than the 3.5 h left") });
});

test("removing a required device moves that feature out of core; an unchanged one says why", () => {
  const noPi = { ...team, hardware: ["Laptop"] };
  const [f1, f2] = assess(candidates, noPi);
  expect(f1.recommendedScope).toBe("later");
  expect(f1.profileInfluences[0]).toMatchObject({ field: "hardware", value: ["Laptop"], tradeoff: expect.stringContaining("Raspberry Pi") });
  expect(f2.recommendedScope).toBe("core");
  expect(f2.profileInfluences.map((i) => i.field)).toContain("hoursLeft"); // explained, not silent
});

test("unknown hardware, skills or time never exclude a feature; they leave an unverified gap", () => {
  const out = assess(candidates, UNKNOWN);
  expect(out.map((f) => f.recommendedScope)).toEqual(["core", "core", "core"]);
  expect(out.every((f) => f.profileInfluences.length === 0)).toBe(true);
  expect(out[0].gaps.map((g) => g.text).join(" ")).toMatch(/hardware[\s\S]*skills[\s\S]*time left/);
  expect(out.flatMap((f) => f.gaps).every((g) => g.label === "unverified" && g.sourceIds.length === 0)).toBe(true);
});

test("a missing skill makes a feature optional; low enthusiasm keeps the core to two", () => {
  expect(assess(candidates, { ...team, skills: ["Python"] })[0].recommendedScope).toBe("optional");
  expect(scopes({ ...team, enthusiasm: 2 })).toEqual(["core", "core", "optional"]);
});

test("influence values are only what the profile holds; interests explain without changing scope", () => {
  const climate = [{ ...candidates[2], title: claim("Climate history charts") }];
  const [f] = assess(climate, team);
  expect(f.profileInfluences).toContainEqual({ field: "interests", value: ["climate"], tradeoff: expect.any(String) });
  for (const i of assess(candidates, team).flatMap((x) => x.profileInfluences)) {
    const held = team[i.field];
    if (Array.isArray(i.value)) expect(i.value.every((v) => (held as string[]).includes(v))).toBe(true);
    else expect(i.value).toBe(held);
  }
});

test("grounding drops source ids the retrieval didn't return and keeps 'supported' only for exact quotes", () => {
  const sources = new Map([["v1", ["Helps teams share meals"]]]);
  expect(ground({ text: "Helps teams share meals", label: "supported", sourceIds: ["v1"] }, sources)).toEqual({ text: "Helps teams share meals", label: "supported", sourceIds: ["v1"] });
  // Citing a source the retrieval never returned: the id is dropped and the claim can't stay supported.
  expect(ground({ text: "Helps teams share meals", label: "supported", sourceIds: ["v1", "made-up"] }, sources)).toEqual({ text: "Helps teams share meals", label: "unverified", sourceIds: ["v1"] });
  expect(ground({ text: "Teams love it", label: "supported", sourceIds: ["v1"] }, sources).label).toBe("inferred");
});

test("the demo sketch is the core items' demo steps, in recommendation order", () => {
  const out = assess(candidates, team);
  expect(sketch(out, new Map([["f3", "core"], ["f1", "core"], ["f2", "later"]]))).toEqual([candidates[0].demoStep, candidates[2].demoStep]);
});

test("the profile accepts unknowns and rejects out-of-range values", () => {
  expect(profileSchema.safeParse(UNKNOWN).success).toBe(true);
  expect(profileSchema.safeParse({ ...UNKNOWN, hoursLeft: 0 }).success).toBe(false);
  expect(profileSchema.safeParse({ ...UNKNOWN, teamSize: 1.5 }).success).toBe(false);
  expect(profileSchema.safeParse({ ...UNKNOWN, skills: Array(13).fill("x") }).success).toBe(false);
  expect(profileSchema.safeParse({ ...UNKNOWN, enthusiasm: 6 }).success).toBe(false);
});
