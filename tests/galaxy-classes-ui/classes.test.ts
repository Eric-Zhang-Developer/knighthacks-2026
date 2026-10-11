import { describe, expect, it } from "vitest";
import { colourOf, counts, keyOf, matches, MIXED, NEUTRAL, PALETTE, parseClasses, type PrizeFilter, UNCLEAR, wins } from "@/lib/classes";
import fixture from "./fixtures/classes.json";

const ready = (() => {
  const l = parseClasses(fixture);
  if (l.state !== "ready") throw new Error("fixture should load");
  return l.data;
})();
const ids = ["a", "b", "c", "d", "e"];

describe("classes.json loader", () => {
  it("refuses an invalid file", () => {
    expect(parseClasses({ corpus_version: "test-1" }).state).toBe("missing");
  });

  // A release that grew keeps its earlier labels by project id; projects added since are counted, never guessed.
  it("applies a file from an earlier release to the projects it covers and counts the rest as uncategorised", () => {
    const load = parseClasses(fixture);
    expect(load.state).toBe("ready");
    if (load.state !== "ready") return;
    const grown = [...ids, "new-1", "new-2"];
    const { byKey, uncategorised } = counts(load.data, grown, () => true);
    expect(uncategorised).toBe(2 + ids.filter((id) => !load.data.projects[id]).length);
    expect([...byKey.values()].reduce((a, b) => a + b, 0) + uncategorised).toBe(grown.length);
    expect(colourOf(load.data, load.data.projects["new-1"])).toBeNull();
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
    const f = (key: string | null, prize: PrizeFilter = "", event: string | null = null) => ids.filter((id) => matches(ready, id, { key, prize, event }));
    expect(f("health")).toEqual(["a", "b"]);
    expect(f(null, "win")).toEqual(["a", "c"]);
    expect(f("health", "win")).toEqual(["a"]);
    expect(f(null, "1")).toEqual(["a"]);
    expect(f(null, "2")).toEqual([]);
    expect(f(null, "sponsor")).toEqual(["c"]);
    expect(f(null, "win", "Hack B")).toEqual(["c"]); // with an event filter, only that event's prizes count
    expect(counts(ready, ids, () => true, "Hack B").prizes).toBe(1);
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
