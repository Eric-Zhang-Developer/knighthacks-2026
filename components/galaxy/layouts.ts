// Where each star sits in the 3D galaxy's two layouts (specs/features/galaxy-3d). The scene owns rendering, the camera
// and the flight between layouts. Both layouts return xyz per star, centred on 0, inside a unit cube.
import { keyOf, UNCLEAR, type ClassesFile } from "@/lib/classes";
import type { Star } from "./stars";

export type LayoutName = "nebula" | "clouds";
export const LAYOUTS: LayoutName[] = ["nebula", "clouds"];

// nebula: the real embedding positions. clouds: one cloud per category, meaning kept inside each cloud.
// Without classes (still loading or missing), clouds falls back to nebula.
export function layoutOf(name: LayoutName, stars: Star[], classes: ClassesFile | null): Float32Array {
  const real = new Float32Array(stars.flatMap((s) => [s.x, s.y, s.z]));
  if (name === "nebula" || !classes) return real;
  // Projects missing from the file join "not enough text": a small wisp of their own, so no star is dropped.
  return clouds(real, stars.map((s) => keyOf(classes.projects[s.id]) ?? UNCLEAR));
}

// Shape knobs, tuned by eye on the real corpus (8.4k stars, 14 domains + mixed + not enough text).
const SIZE = 1; // cloud radius = SIZE * cbrt(count): a 10x bigger category is ~2.2x wider, so small ones stay readable
const GAP = 1.5; // empty space between neighbouring clouds, in the same units
const CORE = 1.4; // radius ~ distance^CORE inside a cloud: above 1 packs the core and leaves the edge wispy
const FLAT = 0.8; // extra vertical pull on the cloud centres, so the cluster reads as a galaxy disc from an orbiting camera

type Vec = [number, number, number];

function clouds(real: Float32Array, keys: string[]): Float32Array {
  const n = keys.length;
  const groups = new Map<string, number[]>();
  keys.forEach((k, i) => (groups.get(k) ?? groups.set(k, []).get(k)!).push(i));
  const mean = (is: number[]): Vec => [0, 1, 2].map((a) => is.reduce((s, i) => s + real[3 * i + a], 0) / is.length) as Vec;
  const all = mean(keys.map((_, i) => i));

  // Cloud centres start at each category's real centroid lean, scaled up (so devtools lands among finance, commerce
  // and security, and mixed, which leans nowhere, near the middle), then shrink together until they touch: a packed
  // cluster with no overlaps. Neighbouring clouds roughly share a lean; the distances between them are arrangement.
  const ids = [...groups.keys()];
  const centroid = new Map(ids.map((k) => [k, mean(groups.get(k)!)]));
  const radius = ids.map((k) => SIZE * Math.cbrt(groups.get(k)!.length));
  const at: Vec[] = ids.map((k, j) => {
    const c = centroid.get(k)!;
    const t = (j + 1) * 2.399963; // golden angle: a deterministic way apart for two identical centroids
    return [(c[0] - all[0]) * 200 + Math.cos(t) * 1e-3, (c[1] - all[1]) * 200, (c[2] - all[2]) * 200 + Math.sin(t) * 1e-3];
  });
  for (let it = 0; it < 300; it++) {
    for (const p of at) {
      p[0] *= 0.97;
      p[1] *= 0.97 * FLAT;
      p[2] *= 0.97;
    }
    for (let pass = 0; pass < 4; pass++)
      for (let a = 0; a < at.length; a++)
        for (let b = a + 1; b < at.length; b++) {
          const d = [at[b][0] - at[a][0], at[b][1] - at[a][1], at[b][2] - at[a][2]];
          const min = radius[a] + radius[b] + GAP;
          const sq = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
          if (sq >= min * min) continue;
          const len = Math.sqrt(sq);
          const push = min - len;
          const wa = radius[b] / (radius[a] + radius[b]); // the smaller cloud moves more
          for (let k = 0; k < 3; k++) {
            at[a][k] -= (d[k] / len) * push * wa;
            at[b][k] += (d[k] / len) * push * (1 - wa);
          }
        }
  }

  // Inside a cloud: each star keeps its real offset from its category's centroid, scaled so the farthest star sits on
  // the cloud's radius, then pulled in by (distance / farthest)^CORE: a dense core and wispy edges. The pull is smooth
  // in distance, so stars that sit together in the embedding still sit together here.
  const out = new Float32Array(3 * n);
  ids.forEach((k, j) => {
    const is = groups.get(k)!;
    const c = centroid.get(k)!;
    const dist = is.map((i) => Math.hypot(real[3 * i] - c[0], real[3 * i + 1] - c[1], real[3 * i + 2] - c[2]));
    // The farthest 1% would set the scale and leave the rest a speck, so they're held at the radius instead.
    const far = [...dist].sort((a, b) => a - b)[Math.floor(dist.length * 0.99)] || 1;
    is.forEach((i, r) => {
      const s = (radius[j] * Math.min(1, dist[r] / far) ** CORE) / (dist[r] || 1);
      for (let a = 0; a < 3; a++) out[3 * i + a] = at[j][a] + (real[3 * i + a] - c[a]) * s;
    });
  });

  // Same framing as nebula: centred on 0, the longest side spanning 1.
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  out.forEach((v, i) => ((lo[i % 3] = Math.min(lo[i % 3], v)), (hi[i % 3] = Math.max(hi[i % 3], v))));
  const scale = 1 / Math.max(...hi.map((h, a) => h - lo[a]));
  return out.map((v, i) => (v - (lo[i % 3] + hi[i % 3]) / 2) * scale);
}

// Where an idea sits in a layout: its stored neighbours' centre in that layout, so it lands inside the right cloud.
// The centre is of the majority of the neighbours nearest their medoid, so one neighbour in another cloud can't drag the
// idea into the empty space between clouds. No neighbours yet: the idea's own stored position (only meaningful in nebula).
export function placeIdea(neighbours: number[], positions: Float32Array, own: [number, number, number]): [number, number, number] {
  if (!neighbours.length) return own;
  const p = (i: number): Vec => [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]];
  const d = (a: number, b: number) => Math.hypot(...p(a).map((v, k) => v - p(b)[k]));
  const sum = (a: number) => neighbours.reduce((s, b) => s + d(a, b), 0);
  const medoid = neighbours.reduce((best, a) => (sum(a) < sum(best) ? a : best));
  const near = [...neighbours].sort((a, b) => d(a, medoid) - d(b, medoid)).slice(0, Math.ceil((neighbours.length + 1) / 2));
  return [0, 1, 2].map((k) => near.reduce((s, i) => s + positions[3 * i + k], 0) / near.length) as Vec;
}
