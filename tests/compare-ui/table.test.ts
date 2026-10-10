import { expect, it } from "vitest";
import { cell, columns, toggle } from "@/components/compare/table";
import type { Version } from "@/components/revisions/trail";

it("selects up to three versions and toggles off", () => {
  expect(toggle([], "a")).toEqual(["a"]);
  expect(toggle(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
  expect(toggle(["a", "b"], "a")).toEqual(["b"]);
});

it("orders columns by the trail, labelled as in the Revisions trail", () => {
  const trail = [{ versionId: "v1" }, { versionId: "v2" }, { versionId: "v3" }] as Version[];
  expect(columns(trail, ["v3", "v1"]).map((c) => c.label)).toEqual(["Version 1", "Version 3"]);
});

it("finds each version's entry for a criterion", () => {
  const c = { name: "Design", perVersion: [{ versionId: "v1", reason: { text: "x", label: "inferred" as const, sourceIds: [] }, uncertainty: "u" }] };
  expect(cell(c, "v1")?.uncertainty).toBe("u");
  expect(cell(c, "v2")).toBeUndefined();
});
