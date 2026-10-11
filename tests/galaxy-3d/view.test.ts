import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { crowding, dragTurns, FOV, Orbit, TUNED_STARS, type Vec3 } from "@/components/galaxy/view";

// The camera moves like a map (specs/features/galaxy-3d): what's under the pointer stays under it while you drag or
// zoom. Checked by projecting through a real three.js camera placed where the orbit says.
const W = 800;
const H = 600;
function screenOf(view: Orbit, p: Vec3) {
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.005, 100);
  cam.position.set(...view.eye());
  cam.lookAt(...view.target);
  cam.updateMatrixWorld();
  const v = new THREE.Vector3(...p).project(cam);
  return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H };
}
// The world point under a screen pixel, at a depth in front of the camera (the target's by default).
function under(view: Orbit, x: number, y: number, depth = view.dist): Vec3 {
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.005, 100);
  cam.position.set(...view.eye());
  cam.lookAt(...view.target);
  cam.updateMatrixWorld();
  const dir = new THREE.Vector3((x / W) * 2 - 1, 1 - (y / H) * 2, 0.5).unproject(cam).sub(cam.position).normalize();
  const fwd = new THREE.Vector3(...view.target).sub(cam.position);
  const t = (depth * fwd.length()) / dir.dot(fwd);
  return cam.position.clone().addScaledVector(dir, t).toArray() as Vec3;
}
const fresh = () => {
  const v = new Orbit();
  v.setAspect(W, H);
  return v;
};

describe("orbit camera", () => {
  it("zooming keeps the point under the pointer under it", () => {
    const v = fresh();
    const p = under(v, 620, 180);
    v.dollyBy(1.8, { dxPx: 620 - W / 2, dyPx: 180 - H / 2, heightPx: H });
    const s = screenOf(v, p);
    expect(Math.abs(s.x - 620)).toBeLessThan(0.5);
    expect(Math.abs(s.y - 180)).toBeLessThan(0.5);
    expect(v.target).not.toEqual([0, 0, 0]); // it travelled toward the pointer
  });

  it("dragging moves across the map with the point under the pointer", () => {
    const v = fresh();
    const p = under(v, 300, 250);
    v.panBy(140, -60, H);
    const s = screenOf(v, p);
    expect(Math.abs(s.x - 440)).toBeLessThan(0.5);
    expect(Math.abs(s.y - 190)).toBeLessThan(0.5);
  });

  it("grabs a nearer or farther star at its own depth", () => {
    for (const depth of [0.4, 2]) {
      const v = fresh();
      const near = under(v, 250, 400, depth * v.dist);
      v.dollyBy(1.6, { dxPx: 250 - W / 2, dyPx: 400 - H / 2, heightPx: H, depth: depth * v.dist });
      const z = screenOf(v, near);
      expect(Math.hypot(z.x - 250, z.y - 400)).toBeLessThan(0.5);
      const grabbed = under(v, 250, 400, v.depthOf(near));
      v.panBy(-100, 50, H, v.depthOf(grabbed));
      const s = screenOf(v, grabbed);
      expect(Math.hypot(s.x - 150, s.y - 450)).toBeLessThan(0.5);
    }
  });

  it("holds on a selected project: no drag, and zoom stays on it", () => {
    const v = fresh();
    v.held = true;
    v.panBy(140, -60, H);
    v.dollyBy(1.8, { dxPx: 200, dyPx: 100, heightPx: H });
    expect(v.target).toEqual([0, 0, 0]);
  });

  it("a released drag glides on, then stops", () => {
    const v = fresh();
    v.releasePan(800, 0, H);
    v.step(0.1);
    const moved = v.target[0];
    expect(Math.abs(moved)).toBeGreaterThan(0);
    for (let i = 0; i < 300; i++) v.step(0.016);
    expect(v.moving).toBe(false);
  });

  it("waits 20 s before drifting", () => {
    const v = fresh();
    const yaw = v.yaw;
    for (let i = 0; i < 19 * 10; i++) v.step(0.1);
    expect(v.yaw).toBe(yaw);
    for (let i = 0; i < 30; i++) v.step(0.1);
    expect(v.yaw).not.toBe(yaw);
  });
});

describe("which drags turn", () => {
  const press = (button: number, mods: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {}) => ({
    button, altKey: false, ctrlKey: false, metaKey: false, ...mods });
  it("a right-drag turns and a plain left-drag moves across the map (person, 2026-10-11)", () => {
    expect(dragTurns(press(2), false)).toBe(true);
    expect(dragTurns(press(0), false)).toBe(false);
  });
  it("option, ctrl and cmd still turn a left-drag", () => {
    for (const mod of ["altKey", "ctrlKey", "metaKey"] as const) expect(dragTurns(press(0, { [mod]: true }), false)).toBe(true);
  });
  it("with a project held, left- and right-drags both circle it", () => {
    expect(dragTurns(press(0), true)).toBe(true);
    expect(dragTurns(press(2), true)).toBe(true);
  });
});

describe("zoomed-out dimming for a big corpus", () => {
  it("leaves the tuned corpus alone, dims about half at 57k, and dims more as the corpus grows", () => {
    expect(crowding(TUNED_STARS)).toBe(1);
    expect(crowding(1000)).toBe(1);
    expect(crowding(57301)).toBeCloseTo(0.51, 2);
    expect(crowding(100_000)).toBeLessThan(crowding(57301));
  });
});
