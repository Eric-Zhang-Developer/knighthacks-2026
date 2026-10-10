import { expect, it } from "vitest";
import { summarize } from "@/components/explainer/summary";

it("counts stars and events, most-covered first, unknown events kept visible", () => {
  const s = summarize([{ event: "B" }, { event: "A" }, { event: "B" }, { event: null }, {}]);
  expect(s.count).toBe(5);
  expect(s.events).toEqual([
    ["B", 2],
    ["Event unknown", 2],
    ["A", 1],
  ]);
});
