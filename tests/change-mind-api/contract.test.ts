import { expect, test, vi } from "vitest";
import { z } from "zod";

vi.mock("next/dist/compiled/server-only", () => ({}));
const { cap, generatedSchema, groundAssumption, wellFormed } = await import("@/lib/assumptions/contract");
type Item = import("@/lib/assumptions/contract").Item;

const claim = (text = "Teams lose time on meals", label: "supported" | "inferred" | "unverified" = "inferred", sourceIds: string[] = []) => ({ text, label, sourceIds });
const good = (kind: Item["kind"] = "need") => ({ kind, assumption: claim(), reversal: { observe: "Ask five teams how long meals take", reversesIf: "Most say under ten minutes" }, insufficient: false });
const insufficient = { kind: "data" as const, assumption: claim(), reversal: null, insufficient: true };
const neither = { kind: "feasibility" as const, assumption: claim(), reversal: null, insufficient: false };
const both = { ...good("differentiation"), insufficient: true };
const hedged = { kind: "need" as const, assumption: claim(), reversal: { observe: "maybe", reversesIf: "unclear" }, insufficient: false };

test("exactly one of a usable reversal or insufficient", () => {
  expect(wellFormed(good())).toBe(true);
  expect(wellFormed(insufficient)).toBe(true);
  expect(wellFormed(neither)).toBe(false);
  expect(wellFormed(both)).toBe(false);
  expect(wellFormed(hedged)).toBe(false);
  expect(wellFormed({ ...good(), reversal: { observe: " ", reversesIf: "x" } })).toBe(false);
  expect(wellFormed({ ...good(), reversal: { observe: "It depends.", reversesIf: "Most say under ten minutes" } })).toBe(false);
});

test("a malformed item is rejected once (so generate regenerates), then dropped", async () => {
  const schema = generatedSchema();
  const output = { assumptions: [good(), insufficient, neither, hedged] };
  expect((await schema.safeParseAsync(output)).success).toBe(false);
  const second = await schema.safeParseAsync(output);
  expect(second.success && second.data.assumptions).toEqual([good(), insufficient]);
  // A fresh schema (a new generation) is strict again.
  expect((await generatedSchema().safeParseAsync({ assumptions: [good()] })).success).toBe(true);
  expect((await generatedSchema().safeParseAsync({ assumptions: [neither] })).success).toBe(false);
});

test("the schema converts to JSON Schema, as generate requires", () => {
  expect(() => z.toJSONSchema(generatedSchema(), { io: "input" })).not.toThrow();
});

test("at most 2 per kind and 6 overall, in order", () => {
  const items = [good("need"), good("need"), good("need"), good("data"), good("data"), good("feasibility"), good("differentiation"), good("differentiation")];
  const kept = cap(items);
  expect(kept.map((i) => i.kind)).toEqual(["need", "need", "data", "data", "feasibility", "differentiation"]);
});

test("claims cite only evidence-card projects; supported must quote a cited card", () => {
  const cards = [{ projectId: "p1", excerpt: "Teams lose time on meals during hackathons." }];
  expect(groundAssumption(claim("Teams lose time on meals", "supported", ["p1"]), cards)).toEqual(claim("Teams lose time on meals", "supported", ["p1"]));
  expect(groundAssumption(claim("Not in the excerpt", "supported", ["p1"]), cards).label).toBe("unverified");
  expect(groundAssumption(claim("Teams lose time on meals", "supported", []), cards).label).toBe("unverified");
  expect(groundAssumption(claim("Teams lose time on meals", "inferred", ["p1", "outside"]), cards)).toEqual(claim("Teams lose time on meals", "unverified", ["p1"]));
});
