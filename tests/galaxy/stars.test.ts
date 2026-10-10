import { describe, expect, it } from "vitest";
import { parseStars, pickNearest, STYLE, styleFor } from "@/components/galaxy/stars";
import fixture from "./stars.synthetic.json";

describe("galaxy stars", () => {
  it("parses stars.json and rejects a malformed one", () => {
    expect(parseStars(fixture).stars).toHaveLength(fixture.count);
    expect(() => parseStars({ count: 1, stars: [{ id: "x" }] })).toThrow();
  });

  it("picks the nearest star within the radius, skipping off-screen ones", () => {
    const screen = new Float32Array([100, 100, 104, 100, NaN, NaN]);
    expect(pickNearest(screen, 103, 100, 10)).toBe(1);
    expect(pickNearest(screen, 100, 120, 10)).toBe(-1);
    expect(pickNearest(new Float32Array([NaN, NaN]), 0, 0, 10)).toBe(-1);
  });

  it("pairs every state's colour with a distinct size", () => {
    const highlighted = new Set(["h"]);
    expect(styleFor("s", "s", highlighted)).toBe(STYLE.selected);
    expect(styleFor("h", "s", highlighted)).toBe(STYLE.highlighted);
    expect(styleFor("o", "s", highlighted)).toBe(STYLE.base);
    const sizes = Object.values(STYLE).map((s) => s.size);
    expect(new Set(sizes).size).toBe(sizes.length);
  });
});
