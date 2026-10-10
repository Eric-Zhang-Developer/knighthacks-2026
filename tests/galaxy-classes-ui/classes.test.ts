import { describe, expect, it } from "vitest";
import { counts, keyOf, matches, MIXED, NEUTRAL, PALETTE, parseClasses, UNCLEAR, wins, colourOf } from "@/lib/classes";
import fixture from "./fixtures/classes.json";

const ready = (() => {
  const l = parseClasses(fixture, "test-1");
  if (l.state !== "ready") throw new Error("fixture should load");
  return l.data;
})();
const ids = ["a", "b", "c", "d", "e"];

describe("classes.json loader", () => {
  it("refuses a file for another corpus and an invalid file", () => {
    expect(parseClasses(fixture, "other").state).toBe("missing");
    expect(parseClasses({ corpus_version: "test-1" }, "test-1").state).toBe("missing");
  });

  it("puts mixed and not-enough-text projects under their own keys", () => {
    expect(ids.map((id) => keyOf(ready.projects[id]))).toEqual(["health", "health", "education", MIXED, UNCLEAR]);
    expect(colourOf(ready, ready.projects.d)).toEqual(NEUTRAL);
    expect(colourOf(ready, ready.projects.a)).toEqual(PALETTE[0]);
  });

  it("counts only placement and sponsor prizes as wins, and only the filtered event's", () => {
    expect(wins(ready.projects.a)).toHaveLength(1);
    expect(wins(ready.projects.b)).toHaveLength(0); // participation
    expect(wins(ready.projects.c, "Hack A")).toHaveLength(0);
    expect(wins(ready.projects.c, "Hack B")).toHaveLength(1);
  });

  it("legend counts agree with the filter", () => {
    const { byKey, prizes } = counts(ready, ids, () => true);
    expect(Object.fromEntries(byKey)).toEqual({ health: 2, education: 1, [MIXED]: 1, [UNCLEAR]: 1 });
    expect([...byKey.values()].reduce((a, b) => a + b, 0)).toBe(ids.length);
    expect(prizes).toBe(2);
    expect(ids.filter((id) => matches(ready, id, { key: "health", prizes: false }))).toEqual(["a", "b"]);
    expect(ids.filter((id) => matches(ready, id, { key: null, prizes: true }))).toEqual(["a", "c"]);
    expect(ids.filter((id) => matches(ready, id, { key: "health", prizes: true }))).toEqual(["a"]);
  });
});

// WCAG relative luminance; graphical objects need 3:1 against the map's --bg (#05070d).
const lum = (c: readonly number[]) => {
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
it("every palette hue and the neutral grey clear 3:1 against the map background", () => {
  const bg = lum([5 / 255, 7 / 255, 13 / 255]);
  for (const c of [...PALETTE, NEUTRAL]) expect((lum(c) + 0.05) / (bg + 0.05)).toBeGreaterThanOrEqual(3);
  expect(new Set(PALETTE.map((c) => c.join())).size).toBe(14);
});
