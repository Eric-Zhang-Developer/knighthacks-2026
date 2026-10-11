import { describe, expect, test } from "vitest";
import { Director, introFrame, introLength, landAt, landedAt, scanFrame, scanLength, scanPhase, SCAN } from "@/components/scan/director";

// The scan and intro clock (specs/features/idea-scan, Plan 2 and 4): pure timing, so the order and the end state are
// exact.
describe("scan timeline", () => {
  const cats = [3, 3, 7, -1, 0];
  test("phases run drain, reach, settle, done; five arcs land in under four seconds", () => {
    expect(scanPhase(0, 5)).toBe("drain");
    expect(scanPhase(SCAN.reachAt + 0.01, 5)).toBe("reach");
    expect(scanPhase(landAt(4) + 0.01, 5)).toBe("settle");
    expect(scanPhase(scanLength(5), 5)).toBe("done");
    expect(landAt(4)).toBeLessThan(4);
  });
  test("arcs land closest first, one at a time", () => {
    for (let k = 1; k < 5; k++) expect(landAt(k)).toBeGreaterThan(landAt(k - 1));
    expect(landedAt(landAt(1) + 0.001, 5)).toBe(2);
    const f = scanFrame(landAt(1) + 0.001, cats);
    expect(f.land[0]).toBeGreaterThan(f.land[1]);
    expect(f.land[1]).toBeGreaterThanOrEqual(0);
    expect(f.land[2]).toBe(-1);
    expect(f.reach[0]).toBe(1);
    expect(f.reach[2]).toBeLessThan(1);
  });
  test("the field drains, a landed neighbour's category warms, unknown categories never do", () => {
    const f = scanFrame(landAt(2) + SCAN.warm, cats);
    expect(f.drain).toBe(1);
    expect(f.warm[3]).toBe(1);
    expect(f.warm[7]).toBe(1);
    expect(f.warm[0]).toBe(0); // its arc hasn't landed
    expect([...f.warm].filter((w) => w > 0)).toHaveLength(2);
  });
  test("the settle trades the drain for the idea focus, and the end is at rest", () => {
    const mid = scanFrame(landAt(4) + SCAN.settle / 2, cats);
    expect(mid.drain).toBeCloseTo(1 - mid.fade, 5);
    expect(mid.fade).toBeGreaterThan(0);
    const end = scanFrame(scanLength(5) + 1, cats);
    expect(end.drain).toBe(0);
    expect(end.fade).toBe(0);
    expect([...end.reach.slice(0, 5)]).toEqual([1, 1, 1, 1, 1]);
  });
});

describe("intro timeline", () => {
  test("clouds light in the given order, then the field is back in colour", () => {
    const order = [5, 2, 9];
    const f = introFrame(0.9, order);
    expect(f.drain).toBe(1);
    expect(f.warm[5]).toBeGreaterThan(f.warm[2]);
    expect(f.warm[9]).toBe(0);
    expect(introFrame(introLength(3), order).drain).toBe(0);
  });
});

describe("director", () => {
  test("emits each phase once, ends at done, and replays", () => {
    const d = new Director();
    const seen: string[] = [];
    const landed: number[] = [];
    d.subscribe((s) => (seen.at(-1) !== s.scan && seen.push(s.scan), landed.at(-1) !== s.landed && landed.push(s.landed)));
    d.startScan("v1", [1, 2, 3, 4, 5], 100);
    for (let t = 100; t < 100 + scanLength(5) + 0.2; t += 1 / 60) d.tick(t);
    expect(seen).toEqual(["drain", "reach", "settle", "done"]);
    expect(landed).toEqual([0, 1, 2, 3, 4, 5]); // one event per landing
    expect(d.status).toMatchObject({ scan: "done", landed: 5, key: "v1" });
    expect(d.tick(200)).toBeNull();
    d.startScan("v1", [1, 2, 3, 4, 5], 300);
    expect(d.status.scan).toBe("drain");
  });
  test("skip ends a scan at once; reduced motion never animates", () => {
    const d = new Director();
    d.startScan("v1", [0, 0, 0], 0);
    d.tick(0.2);
    d.skip(0.3);
    expect(d.status).toMatchObject({ scan: "done", landed: 3 });
    expect(d.tick(0.4)).toBeNull();
    const r = new Director();
    r.reduced = true;
    r.startScan("v2", [0, 0, 0, 0, 0], 0);
    expect(r.status).toMatchObject({ scan: "done", landed: 5, key: "v2" });
    expect(r.needsFraming).toBe(false);
    r.startIntro([1, 2], 0);
    expect(r.status.intro).toBe("done");
  });
  test("a scan asked for during the intro waits for it, then plays", () => {
    const d = new Director();
    d.startIntro([1, 2, 3], 0);
    d.startScan("v1", [1], 0.5);
    expect(d.status.scan).toBe("idle");
    d.tick(introLength(3) + 0.01);
    expect(d.status.intro).toBe("done");
    expect(d.status.scan).toBe("drain");
  });
});
