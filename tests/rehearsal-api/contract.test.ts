import { expect, test, vi } from "vitest";
vi.mock("next/dist/compiled/server-only", () => ({}));
import { builtHash, ground, pitchStatus, rehearsalSchema } from "@/lib/rehearsal/contract";

const built = ["voice search", "a shared meal list"];
const q = (text: string, label: "supported" | "inferred" = "supported") => ({ question: "Does it work offline?", weakness: "Needs a network", basis: { text, label, sourceIds: [] } });

test("a sentence is built only when it quotes a built item; the model can never upgrade one", () => {
  expect(pitchStatus("Try voice search on stage.", "built", built)).toBe("built");
  expect(pitchStatus("Payments already work.", "built", built)).toBe("planned");
  expect(pitchStatus("Then voice search finds a meal.", "planned", built)).toBe("planned");
  expect(pitchStatus("Try Voice Search on stage.", "built", built)).toBe("planned"); // verbatim means exact
});

test("basis is supported only when it quotes a field or a built item, sourced to the version", () => {
  const out = { pitch: [{ text: "Try voice search.", status: "built" as const }],
    questions: [q("a shared meal list"), q("Plan meals together"), q("Judges like demos")] };
  const r = ground(out, "v1", ["Plan meals together", null], built);
  expect(r.questions.map((x) => x.basis)).toEqual([
    { text: "a shared meal list", label: "supported", sourceIds: ["v1"] },
    { text: "Plan meals together", label: "supported", sourceIds: ["v1"] },
    { text: "Judges like demos", label: "inferred", sourceIds: [] },
  ]);
});

test("three questions and at most 90 words, or the output is rejected", () => {
  const ok = { pitch: [{ text: "word ".repeat(90).trim(), status: "planned" }], questions: [q("a"), q("b"), q("c")] };
  expect(rehearsalSchema.safeParse(ok).success).toBe(true);
  expect(rehearsalSchema.safeParse({ ...ok, pitch: [{ text: "word ".repeat(91).trim(), status: "planned" }] }).success).toBe(false);
  expect(rehearsalSchema.safeParse({ ...ok, questions: [q("a"), q("b")] }).success).toBe(false);
});

test("the built list hashes the same in any order", () => {
  expect(builtHash(["b", "a"])).toBe(builtHash(["a", "b"]));
  expect(builtHash(["a"])).not.toBe(builtHash(["a", "b"]));
});
