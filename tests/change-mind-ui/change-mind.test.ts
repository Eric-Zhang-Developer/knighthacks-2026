import { expect, test } from "vitest";
import { byKind, type Assumption } from "@/components/challenge/change-mind";

const item = (kind: Assumption["kind"], text: string): Assumption => ({
  kind, assumption: { text, label: "inferred", sourceIds: [] }, reversal: null, insufficient: true,
});

test("assumptions group by kind in a fixed order, empty kinds left out", () => {
  const groups = byKind([item("feasibility", "f"), item("need", "n1"), item("need", "n2"), item("differentiation", "d")]);
  expect(groups.map(([k, list]) => [k, list.map((i) => i.assumption.text)])).toEqual([
    ["need", ["n1", "n2"]],
    ["feasibility", ["f"]],
    ["differentiation", ["d"]],
  ]);
  expect(byKind([])).toEqual([]);
});
