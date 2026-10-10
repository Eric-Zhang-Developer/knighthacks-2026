import { expect, it } from "vitest";
import { nextStep, reviseContext, type Round } from "@/components/challenge/rounds";

const r = (n: number, outcome?: Round["outcome"]): Round => ({
  round: n,
  question: `q${n}`,
  assumption: `a${n}`,
  source: { text: "s", label: "unverified", sourceIds: [] },
  ...(outcome && { answer: "yes", outcome }),
});

it("walks a session: answer, next, and only a new session after round 3", () => {
  expect(nextStep([])).toBe("start");
  expect(nextStep([r(1)])).toBe("answer");
  expect(nextStep([r(1, "revise")])).toBe("next");
  expect(nextStep([r(1, "revise"), r(2, "test"), r(3)])).toBe("answer");
  expect(nextStep([r(1, "revise"), r(2, "test"), r(3, "answered well")])).toBe("done");
});

it("names the challenged assumption in the revision context, within the API's limit", () => {
  expect(reviseContext(r(1, "revise"))).toContain("Assumption: a1");
  expect(reviseContext({ ...r(1, "revise"), answer: "x".repeat(5000) }).length).toBe(4000);
});
