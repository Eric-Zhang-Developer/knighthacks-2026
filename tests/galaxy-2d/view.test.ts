import { describe, expect, it } from "vitest";
import { boundsOf, StarGrid, Viewport } from "@/components/galaxy/view";

const box = { minX: -1, minY: -0.5, maxX: 1, maxY: 0.5 };
const fresh = () => {
  const v = new Viewport();
  v.setBounds(box, 800, 400);
  return v;
};
const settle = (v: Viewport) => {
  for (let i = 0; i < 600 && v.moving; i++) v.step(1 / 60);
};

describe("Viewport", () => {
  it("starts on the whole map, centred", () => {
    const v = fresh();
    expect([v.x, v.y]).toEqual([0, 0]);
    expect(v.zoom).toBeCloseTo(0.9 * 400); // the shorter fit: 400px for 1 unit of height
  });

  it("a resize keeps the relative zoom: a phone isn't left zoomed into a corner", () => {
    const v = fresh();
    v.zoomAt(2, 400, 200);
    v.setBounds(box, 390, 300);
    expect(v.zoomOverFit).toBeCloseTo(2);
    expect(v.zoom).toBeCloseTo(2 * 0.9 * 195); // the new fit: 390px for 2 units of width
  });

  it("pans 1:1 with the pointer, y up", () => {
    const v = fresh();
    const a = v.toScreen(0.2, 0.1);
    v.panBy(50, -30);
    const b = v.toScreen(0.2, 0.1);
    expect(b.x - a.x).toBeCloseTo(50);
    expect(b.y - a.y).toBeCloseTo(-30);
  });

  it("zooms about the pointer: the world point under it stays put", () => {
    const v = fresh();
    const before = v.toWorld(600, 100);
    v.zoomAt(3, 600, 100);
    const after = v.toWorld(600, 100);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(v.zoomOverFit).toBeCloseTo(3);
  });

  it("clamps zoom between half the whole map and 40x in", () => {
    const v = fresh();
    v.zoomAt(1000, 400, 200);
    expect(v.zoomOverFit).toBeCloseTo(40);
    v.zoomAt(1e-6, 400, 200);
    expect(v.zoomOverFit).toBeCloseTo(0.5);
  });

  it("momentum keeps going after release and comes to rest", () => {
    const v = fresh();
    v.panBy(10, 0);
    const x0 = v.x;
    v.release(1000, 0); // px/s to the right: the view moves left in world units
    settle(v);
    expect(v.moving).toBe(false);
    expect(v.x).toBeLessThan(x0);
    // 0.998 per ms projects about v/1000 * 0.998 / 0.002 = 499px for 1000 px/s
    expect((x0 - v.x) * v.zoom).toBeGreaterThan(400);
    expect((x0 - v.x) * v.zoom).toBeLessThan(520);
  });

  it("fly-to springs to the star without overshooting, within 1 s", () => {
    const v = fresh();
    v.flyTo(0.8, -0.3);
    let maxX = 0;
    for (let t = 0; t < 1; t += 1 / 60) {
      v.step(1 / 60);
      maxX = Math.max(maxX, v.x);
    }
    expect(v.toScreen(0.8, -0.3).x).toBeCloseTo(400, 0);
    expect(v.toScreen(0.8, -0.3).y).toBeCloseTo(200, 0);
    expect(maxX).toBeLessThanOrEqual(0.8 + 1e-6); // critically damped: no bounce
    expect(v.zoomOverFit).toBeCloseTo(2);
  });

  it("a drag interrupts a spring where it is", () => {
    const v = fresh();
    v.flyTo(0.8, 0);
    v.step(0.1);
    const mid = v.x;
    v.panBy(0, 0);
    expect(v.moving).toBe(false);
    expect(v.x).toBe(mid);
  });

  it("reduced motion jumps and has no momentum", () => {
    const v = fresh();
    v.reduced = true;
    v.flyTo(0.5, 0.2);
    expect([v.x, v.y]).toEqual([0.5, 0.2]);
    v.release(2000, 0);
    expect(v.moving).toBe(false);
  });

  it("fit returns to the whole map", () => {
    const v = fresh();
    v.zoomAt(5, 700, 50);
    v.fit();
    settle(v);
    expect(v.zoomOverFit).toBeCloseTo(1);
    expect(v.x).toBeCloseTo(0);
  });
});

describe("StarGrid", () => {
  const positions = new Float32Array([0, 0, 0, 0.5, 0.5, 0.3, -0.9, 0.4, 0, 0.51, 0.5, 0]);
  const grid = new StarGrid(positions, boundsOf(positions));

  it("finds the nearest visible star within the radius", () => {
    expect(grid.nearest(0.505, 0.5, 0.05, [1, 1, 1, 1])).toBeOneOf([1, 3]);
    expect(grid.nearest(0.52, 0.5, 0.05, [1, 1, 1, 1])).toBe(3);
    expect(grid.nearest(0.52, 0.5, 0.05, [1, 1, 1, 0])).toBe(1); // hidden stars aren't picked
    expect(grid.nearest(0.2, 0.2, 0.05, [1, 1, 1, 1])).toBe(-1);
  });

  it("agrees with a brute-force search", () => {
    const n = 2000;
    const pts = new Float32Array(n * 3).map((_, i) => (i % 3 === 2 ? 0 : Math.sin(i * 12.9898) * 0.5));
    const g = new StarGrid(pts, boundsOf(pts));
    const vis = new Uint8Array(n).fill(1);
    for (let q = 0; q < 50; q++) {
      const [x, y] = [Math.cos(q) * 0.4, Math.sin(q * 1.7) * 0.4];
      let best = -1;
      let bd = 0.03 ** 2;
      for (let i = 0; i < n; i++) {
        const d = (pts[3 * i] - x) ** 2 + (pts[3 * i + 1] - y) ** 2;
        if (d <= bd) [best, bd] = [i, d];
      }
      expect(g.nearest(x, y, 0.03, vis)).toBe(best);
    }
  });
});
