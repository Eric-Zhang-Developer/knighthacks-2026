import { expect, test, vi } from "vitest";
vi.mock("next/dist/compiled/server-only", () => ({}));
import { ground, inputSchema, outputSchema } from "@/lib/plan/contract";
const claim = (text: string) => ({ text, label: "supported" as const, sourceIds: ["source"] });
const fixture = { tour: [claim("Stored statement")], cut: [claim("Made-up guarantee")],
  timeline: [{ hour: 0, goal: "Start", label: "inferred", sourceIds: [] },
    { hour: 9, goal: "Code freeze", label: "inferred", sourceIds: [] }],
  risks: [{ risk: "Stored statement", countermeasure: "Untested mitigation", label: "supported", sourceIds: ["source"] }] };
test("deadline validation rejects late freezes, missing freeze, non-increasing hours and extra odds fields", () => {
  const schema = outputSchema(10);
  expect(schema.safeParse(fixture).success).toBe(true);
  expect(schema.safeParse({ ...fixture, timeline: [fixture.timeline[0], { ...fixture.timeline[1], hour: 9.1 }] }).success).toBe(false);
  expect(schema.safeParse({ ...fixture, timeline: [fixture.timeline[0], { ...fixture.timeline[1], goal: "Keep building" }] }).success).toBe(false);
  expect(schema.safeParse({ ...fixture, timeline: [{ ...fixture.timeline[0], hour: 9 }, fixture.timeline[1]] }).success).toBe(false);
  expect(schema.safeParse({ ...fixture, winProbability: 0.9 }).success).toBe(false);
  expect(schema.safeParse({ ...fixture, tour: Array(7).fill(fixture.tour[0]) }).success).toBe(false);
});
test("provenance checks complete item text and rejects foreign citations without upgrading labels", () => {
  const p = outputSchema(10).parse(fixture);
  p.tour.push({ text: "Stored statement", label: "supported", sourceIds: ["foreign"] });
  p.tour.push({ text: "Stored statement", label: "unverified", sourceIds: ["source"] });
  const grounded = ground(p, new Map([["source", ["Stored statement"]]]));
  expect(grounded.tour.map((x) => x.label)).toEqual(["supported", "unverified", "unverified"]);
  expect(grounded.tour[1].sourceIds).toEqual([]);
  expect(grounded.cut[0].label).toBe("inferred");
  expect(grounded.risks[0].label).toBe("inferred");
});
test("bounded team/skills and remaining time are validated before generation", () => {
  expect(inputSchema.parse({ hoursLeft: 10 })).toEqual({ hoursLeft: 10, teamSize: 2, skills: [] });
  for (const hoursLeft of [0, 1, 73, "10"]) expect(inputSchema.safeParse({ hoursLeft }).success).toBe(false);
  expect(inputSchema.safeParse({ hoursLeft: 10, teamSize: 1.5 }).success).toBe(false);
  expect(inputSchema.safeParse({ hoursLeft: 10, skills: Array(13).fill("TypeScript") }).success).toBe(false);
});
