import { expect, test } from "vitest";
import { fromStored, nextStep, type StoredSession } from "@/components/challenge/rounds";

const src = { text: "A neighbour did this", label: "supported" as const, sourceIds: ["p1"] };
const round = (n: number, status: string, extra: Partial<StoredSession["rounds"][number]> = {}) =>
  ({ round: n, status, question: `Q${n}`, assumption: `A${n}`, source: src, answer: null, outcome: null, ...extra });
const session = (state: StoredSession["state"], rounds: StoredSession["rounds"]): StoredSession =>
  ({ versionId: "v", sessionId: "s", perspective: "user", state, rounds });

test("stored rounds keep their answers and outcomes; a round with no source or a failed one is unfinished", () => {
  const r = fromStored(session("idle", [round(1, "answered", { answer: "Yes", outcome: "test" }),
    round(2, "failed", { question: null, assumption: null, source: null })]));
  expect(r[0]).toEqual({ round: 1, question: "Q1", assumption: "A1", source: src, answer: "Yes", outcome: "test" });
  expect(r[1]).toEqual({ round: 2, question: null, assumption: null, source: null, unfinished: true });
});

test("the next step continues from the stored state", () => {
  const answered = round(1, "answered", { answer: "Yes", outcome: "answered well" });
  expect(nextStep([])).toBe("start");
  expect(nextStep(fromStored(session("awaiting", [answered, round(2, "awaiting")])), "awaiting")).toBe("answer");
  expect(nextStep(fromStored(session("idle", [answered])), "idle")).toBe("next");
  expect(nextStep(fromStored(session("idle", [answered, round(2, "failed", { source: null })])), "idle")).toBe("next");
  expect(nextStep(fromStored(session("generating", [answered, round(2, "generating", { source: null })])), "generating")).toBe("stuck");
  expect(nextStep(fromStored(session("answering", [answered, round(2, "answering")])), "answering")).toBe("stuck");
  const three = [answered, { ...answered, round: 2 }, { ...answered, round: 3 }];
  expect(nextStep(fromStored(session("idle", three)), "idle")).toBe("done");
  // A failed answer leaves a question with no outcome: not answerable again, so the next round is offered.
  expect(nextStep(fromStored(session("idle", [round(1, "failed")])), "idle")).toBe("next");
});
