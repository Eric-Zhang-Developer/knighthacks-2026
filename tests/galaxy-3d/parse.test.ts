import { describe, expect, it } from "vitest";
import { z } from "zod";
import { isStar, parseStars } from "@/components/galaxy/stars";

// The schema as zod states it (components/galaxy/stars.ts `Star`): the fast check must accept exactly what it accepts.
const Star = z.object({ id: z.string(), x: z.number(), y: z.number(), z: z.number(), title: z.string(), event: z.string().nullish(), year: z.number().nullish() });

describe("parseStars", () => {
  const good = { id: "a", x: 0.1, y: -0.2, z: 0.3, title: "T", event: "E", year: 2024 };
  const values: unknown[] = [undefined, null, "s", "", 0, 1, -2.5, NaN, Infinity, -Infinity, true, {}, []];
  it("accepts and rejects exactly what the zod schema does, field by field", () => {
    for (const key of Object.keys(good))
      for (const v of values) {
        const star = { ...good, [key]: v };
        expect(isStar(star), `${key}=${String(v)}`).toBe(Star.safeParse(star).success);
      }
    for (const s of [null, "x", [], { ...good, extra: 1 }, { id: "a", x: 0, y: 0, z: 0, title: "no event or year" }]) expect(isStar(s)).toBe(Star.safeParse(s).success);
  });
  it("throws on a bad star with zod's message, and on a bad head", () => {
    expect(parseStars({ corpus_version: "v", count: 1, stars: [good] }).stars[0]).toEqual(good);
    expect(() => parseStars({ corpus_version: "v", count: 2, stars: [good, { ...good, x: "0" }] })).toThrow(/expected number/i);
    expect(() => parseStars({ corpus_version: "v", stars: [] })).toThrow();
  });
});
