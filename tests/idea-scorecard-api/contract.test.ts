import { expect, test } from "vitest";
import { INSUFFICIENT, outputSchema, settle } from "@/lib/scorecard/contract";

const p = (text: string, sourceIds: string[] = [], label = "supported") => ({ text, label, sourceIds }) as never;
const c = (score: number | null, pro = [p("Good")], con = [p("Bad")]) => ({ score, for: pro, against: con });
const all = (x = c(3)) => ({ originality: c(3, [p("Unlike p1", ["p1"])], [p("Close to p2", ["p2"])]), technicalUnderstanding: x, functionality: x, design: x, wowFactor: x });
const known = new Set(["p1", "p2"]);

test("five criteria in rubric order, each scored on its own; uncited points are inferred, cited ones supported", () => {
  const r = settle(outputSchema.parse(all()), known);
  expect(r.map((x) => x.criterion)).toEqual(["Originality", "Technical Understanding", "Functionality", "Design", "Wow Factor"]);
  expect(r[0]).toEqual({ criterion: "Originality", score: 3, note: null, label: "supported",
    for: [{ text: "Unlike p1", label: "supported", sourceIds: ["p1"] }], against: [{ text: "Close to p2", label: "supported", sourceIds: ["p2"] }] });
  expect(r[1].for[0]).toEqual({ text: "Good", label: "inferred", sourceIds: [] });
  expect(r[1].label).toBe("inferred");
});

test("originality points without a real neighbour are dropped; unknown sources are removed; thin evidence is null, not a guess", () => {
  const out = { ...all(), originality: c(5, [p("Nobody has built here: empty space on the map"), p("Unlike p1", ["p1", "invented"])], [p("Vague worry")]) };
  const [orig] = settle(outputSchema.parse(out), known);
  expect(orig.for).toEqual([{ text: "Unlike p1", label: "supported", sourceIds: ["p1"] }]);
  expect(orig.against).toEqual([]);
  // #468: an unscored criterion never wears "supported" beside "evidence is insufficient", however well its one side is cited.
  expect(orig).toMatchObject({ score: null, note: INSUFFICIENT, label: "inferred" });
  const nulled = settle(outputSchema.parse({ ...all(), design: c(null) }), known)[3];
  expect(nulled).toMatchObject({ criterion: "Design", score: null, note: INSUFFICIENT });
});

test("a known citation never promotes inferred or unverified claims to supported", () => {
  const out = all(c(3,
    [p("A cautious deduction from p1", ["p1"], "inferred")],
    [p("An unsupported concern that names p2", ["p2"], "unverified")],
  ));
  const result = settle(outputSchema.parse(out), known);
  expect(result[1].for[0]).toEqual({
    text: "A cautious deduction from p1", label: "inferred", sourceIds: ["p1"],
  });
  expect(result[1].against[0]).toEqual({
    text: "An unsupported concern that names p2", label: "unverified", sourceIds: ["p2"],
  });
  expect(result[1].label).toBe("inferred");
});

test("a missing criterion or an out-of-range score is rejected, so generate() retries", () => {
  const four = Object.fromEntries(Object.entries(all()).filter(([k]) => k !== "wowFactor"));
  expect(outputSchema.safeParse(four).success).toBe(false);
  expect(outputSchema.safeParse({ ...all(), design: c(6) }).success).toBe(false);
});
