import { expect, test } from "vitest";
import { layout } from "@/components/challenge/constellation";
import type { Assumption } from "@/components/challenge/change-mind";

const a = (kind: Assumption["kind"], sourceIds: string[]): Assumption =>
  ({ kind, assumption: { text: kind, label: "inferred", sourceIds }, reversal: null, insufficient: true });

test("an edge only where two assumptions cite a same project", () => {
  const { edges } = layout([a("need", ["p1"]), a("data", ["p1", "p2"]), a("feasibility", []), a("need", ["p3"])]);
  expect(edges).toEqual([[0, 1]]);
  expect(layout([a("need", []), a("data", [])]).edges).toEqual([]);
});
test("every node sits in its kind's cluster", () => {
  const { nodes, clusters } = layout([a("need", []), a("need", []), a("differentiation", [])]);
  expect(nodes.map((n) => n.y)).toEqual([clusters.need.y, clusters.need.y, clusters.differentiation.y]);
  expect(nodes[0].x).toBeLessThan(clusters.need.x);
  expect(nodes[1].x).toBeGreaterThan(clusters.need.x);
  expect(nodes[2].x).toBe(clusters.differentiation.x);
});
