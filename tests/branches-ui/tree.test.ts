import { expect, it } from "vitest";
import { addStars, branchVersions, generations } from "@/components/branches/tree";
import type { Version } from "@/components/revisions/trail";

const v = (versionId: string, parentId: string | null) => ({ versionId, parentId, x: 0, y: 0, z: 0 }) as Version;
const trail = [v("v1", null), v("a", "v1"), v("b", "v1"), v("a2", "a")];

it("lays branches side by side, one row per generation", () => {
  expect(generations(trail).map((row) => row.map((x) => x.versionId))).toEqual([["v1"], ["a", "b"], ["a2"]]);
});

it("treats versions that share a parent as branches", () => {
  expect(branchVersions(trail).map((x) => x.versionId)).toEqual(["a", "b"]);
  expect(branchVersions([v("v1", null), v("v2", "v1")])).toEqual([]);
});

it("adds branch stars without duplicating or moving existing ones", () => {
  const stars = [{ versionId: "a", x: 9, y: 9, z: 9 }];
  expect(addStars(stars, [v("a", "v1"), v("b", "v1")])).toEqual([stars[0], { versionId: "b", x: 0, y: 0, z: 0 }]);
});
