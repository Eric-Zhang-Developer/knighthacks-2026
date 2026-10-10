import { expect, test } from "vitest";
import { filterOptions, localMatches, meta, searchUrl } from "@/components/search/filters";

const star = (id: string, event: string | null, year: number | null) => ({ id, x: 0, y: 0, z: 0, title: `T${id}`, event, year });
const stars = [star("a", "Knight Hacks", 2025), star("b", "Knight Hacks", 2026), star("c", "Shell Hacks", 2026), star("d", null, null)];

test("options come from the stars: events by count then name, years newest first, no empty event or year", () => {
  expect(filterOptions(stars)).toEqual({ events: [{ name: "Knight Hacks", count: 2 }, { name: "Shell Hacks", count: 1 }], years: [2026, 2025] });
  expect(filterOptions([])).toEqual({ events: [], years: [] });
});
test("an empty query lists the filter's projects from the stars", () => {
  expect(localMatches(stars, { event: "Knight Hacks", year: "" }).map((h) => h.id)).toEqual(["a", "b"]);
  expect(localMatches(stars, { event: "", year: "2026" }).map((h) => h.id)).toEqual(["b", "c"]);
  expect(localMatches(stars, { event: "Shell Hacks", year: "2025" })).toEqual([]);
});
test("years read as created years, and only set filters reach the URL", () => {
  expect(meta({ event: "Knight Hacks", year: 2026 })).toBe("Knight Hacks · created 2026");
  expect(meta({ event: null, year: null })).toBe("");
  expect(meta({ event: "DSH Hacks V1", year: 2026 }, "BloomKnights")).toBe("BloomKnights · created 2026");
  expect(searchUrl("meal plan", { event: "", year: "" })).toBe("/api/search?q=meal+plan");
  expect(searchUrl("x", { event: "A & B", year: "2026" })).toBe("/api/search?q=x&event=A+%26+B&year=2026");
});
