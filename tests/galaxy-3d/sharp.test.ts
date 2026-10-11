import { describe, expect, it } from "vitest";
import { NAME_MAX, nearestNames, shortTitle } from "@/components/galaxy/stars";
import { Orbit, sharpness } from "@/components/galaxy/view";

// galaxy-3d Validation 7: stars sharpen as the camera closes in, and the nearest ones are named.
describe("sharpness", () => {
  it("is 0 over the whole map, 1 at the closest zoom, and never falls as you zoom in", () => {
    const view = new Orbit();
    expect(sharpness(1)).toBe(0);
    expect(sharpness(view.fitDist / view.minDist)).toBe(1);
    let last = 0;
    for (let z = 0.4; z <= 20; z *= 1.05) {
      expect(sharpness(z)).toBeGreaterThanOrEqual(last);
      last = sharpness(z);
    }
  });
});

describe("nearestNames", () => {
  // A grid of stars 10px apart around the centre: far more than fit, all crowding each other.
  const titles: string[] = [];
  const screen: number[] = [];
  for (let y = -10; y <= 10; y++)
    for (let x = -10; x <= 10; x++) {
      titles.push(`Project ${titles.length} with a fairly long name that gets cut`);
      screen.push(400 + x * 10, 300 + y * 10, x < 0 ? 0.2 : 0.8); // right half is the far side
    }
  const picked = nearestNames(Float32Array.from(screen), titles, 400, 300);
  const box = (i: number) => ({ x0: screen[3 * i] - 4, x1: screen[3 * i] + 14 + shortTitle(titles[i]).length * 6.6, y0: screen[3 * i + 1] - 10, y1: screen[3 * i + 1] + 10 });

  it("names at most ten near-side stars, none overlapping another", () => {
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.length).toBeLessThanOrEqual(NAME_MAX);
    for (const i of picked) expect(screen[3 * i + 2]).toBeLessThan(0.6);
    for (const a of picked)
      for (const b of picked) {
        if (a === b) continue;
        const [p, q] = [box(a), box(b)];
        expect(p.x0 < q.x1 && p.x1 > q.x0 && p.y0 < q.y1 && p.y1 > q.y0).toBe(false);
      }
  });

  it("skips hidden stars and space already taken by a cloud's name", () => {
    const s = Float32Array.from([400, 300, 0, NaN, NaN, NaN, 400, 360, 0]);
    expect(nearestNames(s, ["a", "b", "c"], 400, 300)).toEqual([0, 2]);
    expect(nearestNames(s, ["a", "b", "c"], 400, 300, [{ x0: 380, x1: 460, y0: 290, y1: 310 }])).toEqual([2]);
  });

  it("cuts long titles to 28 characters", () => {
    expect(shortTitle("short")).toBe("short");
    expect(shortTitle("x".repeat(40))).toHaveLength(28);
    expect(shortTitle("x".repeat(40)).endsWith("…")).toBe(true);
  });
});
