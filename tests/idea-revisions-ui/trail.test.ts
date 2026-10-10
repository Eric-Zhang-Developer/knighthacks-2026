import { expect, it } from "vitest";
import { lerpStar, replaceStar, versionNumber, type Version } from "@/components/revisions/trail";

const s = (versionId: string, x = 0) => ({ versionId, x, y: 0, z: 0 });

it("the accepted version replaces the revised star, every frame of the move", () => {
  const stars = [s("other"), s("v1")];
  const frame1 = replaceStar(stars, ["v1", "v2"], s("v2", 0.5));
  expect(frame1).toEqual([s("other"), s("v2", 0.5)]);
  // Next frame: the star already has v2's ID; it must still be replaced, never duplicated.
  expect(replaceStar(frame1, ["v1", "v2"], s("v2", 1))).toEqual([s("other"), s("v2", 1)]);
  expect(replaceStar([s("other")], ["v1", "v2"], s("v2"))).toHaveLength(2);
});

it("interpolates between versions and numbers the trail", () => {
  expect(lerpStar(s("v1", 0), s("v2", 2), 0.25)).toEqual(s("v2", 0.5));
  const trail = [{ versionId: "a" }, { versionId: "b" }] as Version[];
  expect(versionNumber(trail, "b")).toBe(2);
});
