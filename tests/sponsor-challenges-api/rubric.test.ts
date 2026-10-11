import { describe, expect, it } from "vitest";
import { ChallengeError, type ConfirmInput, type Reason, type Rubric } from "@/lib/sponsor-challenges/contract";
import { confirmRubric, scoreRubric, states } from "@/lib/sponsor-challenges/rubric";

const TRANSCRIPT = [
  "Judging criteria: Innovation 40%. Technical execution 35%. Design 25%.",
  "Each criterion is scored 0 to 10.",
  "0 points: no attempt. 5 points: working prototype. 10 points: production quality.",
  "The final score is the weighted sum of criterion scores.",
  "Alternatively, the total is the plain sum of criterion scores.",
  "Final = geometric mean of criteria. Spreadsheet: =SUM(B2:B4)*1.5",
].join("\n");

type RubricIn = NonNullable<ConfirmInput["rubric"]>;
type CriterionIn = RubricIn["criteria"][number];
const scale = { min: 0, max: 10, quote: "scored 0 to 10" };
const anchors = [
  { points: 0, quote: "0 points: no attempt" },
  { points: 5, quote: "5 points: working prototype" },
  { points: 10, quote: "10 points: production quality" },
];
const criterion = (name: string, value: number): CriterionIn => ({
  name, quote: `${name} ${value}%`, scale, anchors, weight: { value, unit: "percent", quote: `${name} ${value}%` },
});
const official = (over: Partial<RubricIn> = {}): RubricIn => ({
  criteria: [criterion("Innovation", 40), criterion("Technical execution", 35), criterion("Design", 25)],
  aggregation: [{ rule: "weighted_sum", quote: "weighted sum of criterion scores" }],
  ...over,
});
const confirmed = (over: Partial<RubricIn> = {}) => confirmRubric(TRANSCRIPT, official(over))!;

const reason: Reason = { text: "The demo runs end to end.", label: "supported", citations: [{ source: "evidence", sourceId: "e1", quote: "demo runs" }] };
const anchorFor = (points: number) => anchors.find((a) => a.points === points)?.quote ?? null;
const estimates = (points: (number | null)[]) =>
  points.map((p, i) => ({ criterionId: `c${i + 1}`, points: p, anchorQuote: p === null ? null : anchorFor(p), reason }));

describe("states", () => {
  it("reads percent, comma decimals and plain integers without evaluating anything", () => {
    expect(states("Innovation 30%", 30)).toBe(true);
    expect(states("weight 0,5", 0.5)).toBe(true);
    expect(states("scored out of 10", 10)).toBe(true);
    expect(states("scored out of 10", 1)).toBe(false);
    expect(states("=SUM(B2:B4)*1.5", 6)).toBe(false);
  });
});

describe("confirmRubric", () => {
  it("accepts a synthetic official rubric and converts percent weights to decimal coefficients", () => {
    const rubric = confirmed();
    expect(rubric.criteria.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    expect(rubric.criteria.map((c) => c.weight)).toEqual([
      { value: 40, unit: "percent", coefficient: 0.4, quote: "Innovation 40%" },
      { value: 35, unit: "percent", coefficient: 0.35, quote: "Technical execution 35%" },
      { value: 25, unit: "percent", coefficient: 0.25, quote: "Design 25%" },
    ]);
    expect(rubric.aggregation).toEqual([{ rule: "weighted_sum", quote: "weighted sum of criterion scores" }]);
  });

  it("returns null for no rubric", () => {
    expect(confirmRubric(TRANSCRIPT, null)).toBeNull();
  });

  const rejects = (input: RubricIn, message: RegExp) => {
    let error: unknown;
    try { confirmRubric(TRANSCRIPT, input); } catch (e) { error = e; }
    expect(error).toBeInstanceOf(ChallengeError);
    expect((error as ChallengeError).status).toBe(400);
    expect((error as ChallengeError).message).toMatch(message);
  };
  const withFirst = (patch: Partial<CriterionIn>): RubricIn => {
    const base = official();
    return { ...base, criteria: [{ ...base.criteria[0], ...patch }, ...base.criteria.slice(1)] };
  };

  it("rejects quotes that are not in the transcript", () => {
    rejects(withFirst({ quote: "Innovation counts double" }), /criterion must quote/);
    rejects(withFirst({ scale: { min: 0, max: 10, quote: "scored zero to 10" } }), /scale must quote/);
    rejects(withFirst({ anchors: [{ points: 5, quote: "5 points: great prototype" }] }), /anchor must quote/);
    rejects(withFirst({ weight: { value: 40, unit: "percent", quote: "Innovation 40 %" } }), /weight must quote/);
    rejects(official({ aggregation: [{ rule: "sum", quote: "add everything up" }] }), /aggregation rule must quote/);
  });

  it("rejects a scale whose quote misses its numbers or whose min is not below max", () => {
    rejects(withFirst({ scale: { min: 1, max: 10, quote: "scored 0 to 10" } }), /state its minimum and maximum/);
    rejects(withFirst({ scale: { min: 0, max: 100, quote: "scored 0 to 10" } }), /state its minimum and maximum/);
    rejects(withFirst({ scale: { min: 10, max: 0, quote: "scored 0 to 10" } }), /minimum below maximum/);
    rejects(withFirst({ scale: { min: 10, max: 10, quote: "scored 0 to 10" } }), /minimum below maximum/);
  });

  it("rejects anchors that misstate their points, fall outside the scale or repeat points", () => {
    rejects(withFirst({ anchors: [{ points: 7, quote: "5 points: working prototype" }] }), /anchor's quote must state its points/);
    rejects(withFirst({ scale: { min: 0, max: 5, quote: "0 points: no attempt. 5 points" }, anchors }), /outside its scale/);
    rejects(withFirst({ anchors: [anchors[1], { points: 5, quote: "5 points" }] }), /same points/);
  });

  it("rejects a weight whose quote misses its value, and a percent weight that does not say percent", () => {
    rejects(withFirst({ weight: { value: 45, unit: "percent", quote: "Innovation 40%" } }), /weight's quote must state its value/);
    rejects(withFirst({ weight: { value: 10, unit: "percent", quote: "scored 0 to 10" } }), /percent weight's quote must say percent/);
  });

  it("accepts a decimal weight and keeps its coefficient unscaled", () => {
    const rubric = confirmRubric("Innovation weight 0,5", {
      criteria: [{ name: "Innovation", quote: "Innovation", scale: null, anchors: [], weight: { value: 0.5, unit: "decimal", quote: "weight 0,5" } }],
      aggregation: [],
    })!;
    expect(rubric.criteria[0].weight?.coefficient).toBe(0.5);
  });

  // Regression: "1-10" once read as 1 and -10, so a range quote could not state its maximum.
  it("accepts a hyphenated range quote such as \"scored 1-10\"", () => {
    const rubric = confirmRubric("Each criterion is scored 1-10.", {
      criteria: [{ name: "Innovation", quote: "Each criterion", scale: { min: 1, max: 10, quote: "scored 1-10" }, anchors: [], weight: null }],
      aggregation: [],
    });
    expect(rubric?.criteria[0].scale).toEqual({ min: 1, max: 10, quote: "scored 1-10" });
  });
});

describe("scoreRubric", () => {
  it("computes the weighted total and maximum on the server: 0.4*5 + 0.35*10 + 0.25*5 = 6.75 of 10", () => {
    const { estimate, nullReason } = scoreRubric(confirmed(), estimates([5, 10, 5]));
    expect(nullReason).toBeNull();
    expect(estimate?.rule).toBe("weighted_sum");
    expect(estimate?.total).toBe(6.75);
    expect(estimate?.maximum).toBe(10);
    expect(estimate?.nullReason).toBeNull();
    expect(estimate?.criteria.map((c) => [c.points, c.anchorQuote])).toEqual([
      [5, "5 points: working prototype"], [10, "10 points: production quality"], [5, "5 points: working prototype"],
    ]);
    expect(estimate?.note).toMatch(/not a judge's score/);
  });

  it("accepts exactly the minimum and maximum anchors", () => {
    const { estimate } = scoreRubric(confirmed(), estimates([0, 10, 10]));
    expect(estimate?.total).toBe(6);
    expect(estimate?.criteria.every((c) => c.nullReason === null)).toBe(true);
  });

  it("computes a plain sum: 5 + 10 + 5 = 20 of 30", () => {
    const { estimate } = scoreRubric(confirmed({ aggregation: [{ rule: "sum", quote: "plain sum of criterion scores" }] }), estimates([5, 10, 5]));
    expect(estimate?.rule).toBe("sum");
    expect(estimate?.total).toBe(20);
    expect(estimate?.maximum).toBe(30);
  });

  it("keeps criterion estimates but nulls a weighted total when a weight is missing", () => {
    const base = official();
    const rubric = confirmed({ criteria: [base.criteria[0], base.criteria[1], { ...base.criteria[2], weight: null }] });
    const { estimate, nullReason } = scoreRubric(rubric, estimates([5, 10, 5]));
    expect(nullReason).toBeNull();
    expect(estimate?.total).toBeNull();
    expect(estimate?.maximum).toBeNull();
    expect(estimate?.rule).toBeNull();
    expect(estimate?.nullReason).toMatch(/no weight/);
    expect(estimate?.criteria.map((c) => c.points)).toEqual([5, 10, 5]);
  });

  it("nulls the total with no aggregation quote", () => {
    const { estimate } = scoreRubric(confirmed({ aggregation: [] }), estimates([5, 10, 5]));
    expect(estimate?.total).toBeNull();
    expect(estimate?.nullReason).toMatch(/no rule/);
    expect(estimate?.criteria.map((c) => c.points)).toEqual([5, 10, 5]);
  });

  it("nulls the total when the brief states two different rules", () => {
    const { estimate } = scoreRubric(confirmed({
      aggregation: [{ rule: "weighted_sum", quote: "weighted sum of criterion scores" }, { rule: "sum", quote: "plain sum of criterion scores" }],
    }), estimates([5, 10, 5]));
    expect(estimate?.total).toBeNull();
    expect(estimate?.nullReason).toMatch(/conflicting/);
  });

  it.each(["=SUM(B2:B4)*1.5", "geometric mean of criteria"])("evaluates nothing for an 'other' rule quoting %s", (quote) => {
    const { estimate } = scoreRubric(confirmed({ aggregation: [{ rule: "other", quote }] }), estimates([5, 10, 5]));
    expect(estimate?.total).toBeNull();
    expect(estimate?.maximum).toBeNull();
    expect(estimate?.rule).toBeNull();
    expect(estimate?.nullReason).toMatch(/computes no other formula/);
  });

  it("nulls a criterion without a scale or anchors, and does not renormalise the rest", () => {
    const base = official();
    const rubric = confirmed({ criteria: [base.criteria[0], { ...base.criteria[1], scale: null }, { ...base.criteria[2], anchors: [] }] });
    const { estimate } = scoreRubric(rubric, estimates([5, 10, 5]));
    expect(estimate?.criteria.map((c) => c.points)).toEqual([5, null, null]);
    expect(estimate?.criteria[1].nullReason).toMatch(/no numeric scale/);
    expect(estimate?.criteria[2].nullReason).toMatch(/no grading anchors/);
    expect(estimate?.total).toBeNull();
    expect(estimate?.nullReason).toMatch(/not counted as zero/);
  });

  it("does not count a missing estimate as zero", () => {
    const { estimate } = scoreRubric(confirmed(), estimates([5, 10]));
    expect(estimate?.criteria[2]).toMatchObject({ points: null, nullReason: expect.stringMatching(/No applicable evidence/) });
    expect(estimate?.total).toBeNull();
    expect(estimate?.nullReason).toMatch(/not counted as zero/);
  });

  it("discards invalid model scores", () => {
    const rubric = confirmed();
    const cases: { points: number | null; anchorQuote: string | null; reason: Reason | null; match: RegExp }[] = [
      { points: 7, anchorQuote: "5 points: working prototype", reason, match: /not one of the brief's anchors/ },
      { points: 11, anchorQuote: "10 points: production quality", reason, match: /not one of the brief's anchors/ },
      { points: -1, anchorQuote: "0 points: no attempt", reason, match: /not one of the brief's anchors/ },
      { points: 5, anchorQuote: "10 points: production quality", reason, match: /anchor does not match/ },
      { points: 5, anchorQuote: null, reason, match: /anchor does not match/ },
      { points: 5, anchorQuote: "5 points: working prototype", reason: null, match: /No cited evidence/ },
      { points: 5, anchorQuote: "5 points: working prototype", reason: { ...reason, citations: [{ source: "brief", sourceId: "rev", quote: "5 points" }] }, match: /No cited evidence/ },
    ];
    for (const c of cases) {
      const { estimate } = scoreRubric(rubric, [{ criterionId: "c1", points: c.points, anchorQuote: c.anchorQuote, reason: c.reason }, ...estimates([5, 10, 5]).slice(1)]);
      expect(estimate?.criteria[0]).toMatchObject({ points: null, anchorQuote: null, nullReason: expect.stringMatching(c.match) });
      expect(estimate?.total).toBeNull();
    }
  });

  it("returns estimate null when no criterion is scorable", () => {
    const result = scoreRubric(confirmed(), [{ criterionId: "c1", points: 7, anchorQuote: null, reason }]);
    expect(result.estimate).toBeNull();
    expect(result.nullReason).toMatch(/No criterion could be estimated/);
  });

  it("ignores estimates for criteria the rubric does not have", () => {
    const rubric: Rubric = confirmed();
    const { estimate } = scoreRubric(rubric, [...estimates([5, 10, 5]), { criterionId: "c9", points: 10, anchorQuote: anchorFor(10), reason }]);
    expect(estimate?.criteria).toHaveLength(3);
    expect(estimate?.total).toBe(6.75);
  });
});
