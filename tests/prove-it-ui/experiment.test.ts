import { expect, test } from "vitest";
import { changedParts, findFor, resultText, type Experiment } from "@/components/challenge/experiment";

const e: Experiment = {
  id: "e1", sessionId: "s1", round: 1, assumption: "a",
  hypothesis: { text: "h", label: "unverified", sourceIds: [] }, procedure: "p", observable: "o", result: null, note: null,
};

test("only changed, nonblank parts go in an edit", () => {
  expect(changedParts(e, { hypothesis: "h", procedure: "p", observable: "o" })).toEqual({});
  expect(changedParts(e, { hypothesis: "h", procedure: " p2 ", observable: "o" })).toEqual({ procedure: "p2" });
  expect(changedParts(e, { hypothesis: "", procedure: "p", observable: "o" })).toEqual({}); // blank is never sent
});

test("no result reads 'Not run'; the UI never implies an outcome", () => {
  expect(resultText(null)).toBe("Not run");
  expect(resultText("refuted")).toBe("Refuted");
});

test("an experiment belongs to one session and round", () => {
  expect(findFor([e], "s1", 1)).toBe(e);
  expect(findFor([e], "s1", 2)).toBeUndefined();
  expect(findFor([e], "s2", 1)).toBeUndefined();
});
