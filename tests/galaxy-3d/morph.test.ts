import { describe, expect, it } from "vitest";
import { Morph, seedOf } from "@/components/galaxy/morph";

// The flight as it was computed eagerly each frame (Math.hypot), as the reference for the lazy `current`.
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
function reference(from: Float32Array, to: Float32Array, t: number) {
  const out = new Float32Array(to.length);
  for (let i = 0; i < to.length / 3; i++) {
    const x = 3 * i;
    const delay = 0.4 * (0.55 * seedOf(i) + 0.45 * Math.min(1, Math.hypot(to[x], to[x + 1], to[x + 2]) / 0.6));
    const k = ease(Math.min(1, Math.max(0, (t - delay) / 0.6)));
    const bow = Math.sin(k * Math.PI) * 0.22 * Math.hypot(to[x] - from[x], to[x + 1] - from[x + 1], to[x + 2] - from[x + 2]);
    const p = [0, 1, 2].map((a) => from[x + a] + (to[x + a] - from[x + a]) * k);
    const len = Math.hypot(p[0], p[1], p[2]) || 1;
    p.forEach((v, a) => (out[x + a] = v + (v / len) * bow));
  }
  return out;
}

describe("Morph", () => {
  let s = 3;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) - 0.5;
  const a = Float32Array.from({ length: 3000 }, rand);
  const b = Float32Array.from({ length: 3000 }, rand);

  it("draws the same flight as the eager per-frame formula, computed only when read", () => {
    const m = new Morph();
    m.set(a, 0, true); // first layout: placed
    m.step(10);
    expect(Array.from(m.current)).toEqual(Array.from(a));
    m.set(b, 10, true);
    for (const now of [10, 10.3, 10.7, 11.1, 11.4, 12]) {
      m.step(now);
      const want = reference(a, b, Math.min(1, (now - 10) / 1.4));
      m.current.forEach((v, i) => expect(v).toBeCloseTo(want[i], 5));
    }
    expect(m.t).toBe(1);
    expect(Array.from(m.current)).toEqual(Array.from(b));
  });

  it("the first animated layout bursts out from the core and lands on the layout", () => {
    const m = new Morph();
    m.set(a, 0, true);
    expect(m.t).toBe(0);
    m.current.forEach((v, i) => expect(v).toBeCloseTo(a[i] * 0.04, 6));
    m.step(0.7);
    const mid = Math.hypot(...m.current.slice(0, 3));
    expect(mid).toBeGreaterThan(Math.hypot(a[0], a[1], a[2]) * 0.04);
    m.step(1.4);
    expect(Array.from(m.current)).toEqual(Array.from(a));
  });

  it("turns around mid-flight from where the stars are drawn", () => {
    const m = new Morph();
    m.set(a, 0, false);
    m.set(b, 0, true);
    m.step(0.7);
    const mid = Float32Array.from(m.current);
    m.set(a, 0.7, true);
    expect(Array.from(m.from)).toEqual(Array.from(mid));
    expect(m.t).toBe(0);
  });

  it("without animation lands at once (from = to, so every t draws the target)", () => {
    const m = new Morph();
    m.set(a, 0, false);
    m.set(b, 0, false);
    expect(Array.from(m.current)).toEqual(Array.from(b));
    m.step(0.5);
    expect(Array.from(m.current)).toEqual(Array.from(b));
  });
});
