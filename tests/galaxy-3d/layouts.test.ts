import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { layoutOf, placeIdea } from "@/components/galaxy/layouts";
import type { Star } from "@/components/galaxy/stars";
import { keyOf, UNCLEAR, type ClassesFile } from "@/lib/classes";

// The real corpus: the clouds are tuned on it, so that's what the checks run on.
const stars: Star[] = JSON.parse(readFileSync("public/corpus/stars.json", "utf8")).stars;
const classes: ClassesFile = JSON.parse(readFileSync("public/classify/classes.json", "utf8"));
const keys = stars.map((s) => keyOf(classes.projects[s.id]) ?? UNCLEAR);
const clouds = layoutOf("clouds", stars, classes);
const dist = (p: Float32Array, a: number, b: number) =>
  Math.hypot(p[3 * a] - p[3 * b], p[3 * a + 1] - p[3 * b + 1], p[3 * a + 2] - p[3 * b + 2]);

describe("layoutOf", () => {
  it("nebula is the real positions; clouds without classes is nebula", () => {
    const real = stars.flatMap((s) => [s.x, s.y, s.z]);
    expect([...layoutOf("nebula", stars, classes)]).toEqual([...new Float32Array(real)]);
    expect(layoutOf("clouds", stars, null)).toEqual(layoutOf("nebula", stars, null));
  });

  it("clouds: xyz for every star, centred, inside the unit cube, the same every time", () => {
    expect(clouds.length).toBe(3 * stars.length);
    expect(clouds.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.5 + 1e-6)).toBe(true);
    for (let a = 0; a < 3; a++) {
      const axis = clouds.filter((_, i) => i % 3 === a);
      expect(Math.max(...axis) + Math.min(...axis)).toBeCloseTo(0, 5); // bounding box centred on 0
    }
    expect(layoutOf("clouds", stars, classes)).toEqual(clouds);
  });

  it("clouds don't overlap: every star's nearest other-category star is farther than a gap", () => {
    // ponytail: brute force over all ~35M pairs, inlined to stay well under a second at this corpus size.
    const names = [...new Set(keys)];
    const id = Int32Array.from(keys, (k) => names.indexOf(k));
    let closest = Infinity;
    for (let a = 0; a < stars.length; a++)
      for (let b = a + 1; b < stars.length; b++) {
        if (id[a] === id[b]) continue;
        const dx = clouds[3 * a] - clouds[3 * b], dy = clouds[3 * a + 1] - clouds[3 * b + 1], dz = clouds[3 * a + 2] - clouds[3 * b + 2];
        closest = Math.min(closest, dx * dx + dy * dy + dz * dz);
      }
    closest = Math.sqrt(closest);
    expect(closest).toBeGreaterThan(0.02); // measured 0.036 on this corpus
  });

  it("clouds keep meaning inside a cloud: distances between a category's stars track the real ones", () => {
    const real = layoutOf("nebula", stars, classes);
    for (const key of ["health", "devtools", "mixed"]) {
      const is = keys.flatMap((k, i) => (k === key ? [i] : [])).slice(0, 150);
      const r: number[] = [];
      const c: number[] = [];
      is.forEach((a, x) => is.slice(x + 1).forEach((b) => (r.push(dist(real, a, b)), c.push(dist(clouds, a, b)))));
      expect(spearman(r, c), key).toBeGreaterThan(0.9);
    }
  });
});

describe("placeIdea", () => {
  const p = new Float32Array([0, 0, 0, 0.2, 0, 0, 0, 0.2, 0, 0.1, 0.1, 0, 0.5, 0.5, 0.5]);
  it("no neighbours: the idea's own position", () => {
    expect(placeIdea([], p, [0.1, 0.2, 0.3])).toEqual([0.1, 0.2, 0.3]);
  });
  it("the centre of its neighbours", () => {
    const [x, y, z] = placeIdea([0, 1], p, [9, 9, 9]);
    expect([x, y, z].map((v) => +v.toFixed(6))).toEqual([0.1, 0, 0]);
  });
  it("one far neighbour (another cloud) doesn't drag the idea into the gap", () => {
    const [x, y, z] = placeIdea([0, 1, 2, 3, 4], p, [9, 9, 9]);
    expect(Math.hypot(x - 0.1, y - 0.1, z)).toBeLessThan(0.12);
  });
});

const ranks = (xs: number[]) => {
  const r = new Array<number>(xs.length);
  xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).forEach(([, i], k) => (r[i] = k));
  return r;
};
function spearman(a: number[], b: number[]) {
  const [ra, rb] = [ranks(a), ranks(b)];
  const m = (a.length - 1) / 2;
  let num = 0, da = 0, db = 0;
  ra.forEach((x, i) => ((num += (x - m) * (rb[i] - m)), (da += (x - m) ** 2), (db += (rb[i] - m) ** 2)));
  return num / Math.sqrt(da * db);
}
