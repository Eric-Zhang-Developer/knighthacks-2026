import { expect, test } from "vitest";
import { eraRows, parseToolUse, RELEASES } from "@/components/era/era";

const stars = [
  { id: "a", year: 2016 }, { id: "b", year: 2022 }, { id: "c", year: 2023 }, { id: "d", year: 2024 },
  { id: "e", year: 2025 }, { id: "f", year: 2026 }, { id: "g", year: null }, { id: "h" },
];
const json = { corpus_version: "v1", projects: { a: { dev_tools: "unknown" }, c: { dev_tools: "reported" }, e: { dev_tools: "reported_non_use" }, f: { dev_tools: "reported" } } };

test("every star lands in exactly one era, by start year, with the boundaries at 2022/2023 and 2024/2025", () => {
  const rows = eraRows(stars, null);
  expect(rows.map((r) => [r.id, r.count])).toEqual([["through-2022", 2], ["2023-2024", 2], ["2025-on", 2], ["unknown", 2]]);
  expect(rows.reduce((n, r) => n + r.count, 0)).toBe(stars.length);
  expect(rows.every((r) => r.tools === null)).toBe(true);
});

test("tool use sums to each row; a project the file doesn't list counts as unknown, never as not used", () => {
  const rows = eraRows(stars, parseToolUse(json, "v1"));
  for (const r of rows) expect(r.tools!.reported + r.tools!.reported_non_use + r.tools!.unknown).toBe(r.count);
  expect(rows[0].tools).toEqual({ reported: 0, reported_non_use: 0, unknown: 2 }); // b is unlisted
  expect(rows[1].tools).toEqual({ reported: 1, reported_non_use: 0, unknown: 1 });
  expect(rows[2].tools).toEqual({ reported: 1, reported_non_use: 1, unknown: 0 });
});

test("a classes file for another corpus, or a malformed one, isn't used", () => {
  expect(parseToolUse(json, "v2")).toBeNull();
  expect(parseToolUse({ corpus_version: "v1", projects: { a: { dev_tools: "maybe" } } }, "v1")).toBeNull();
});

test("releases are dated in order and each links to its source", () => {
  expect(RELEASES.map((r) => r.date)).toEqual([...RELEASES.map((r) => r.date)].sort());
  for (const r of RELEASES) expect(r.href).toMatch(/^https:\/\//);
});
