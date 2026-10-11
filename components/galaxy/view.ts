// The 3D galaxy's camera. An orbit around a target point: yaw, pitch and distance. Pure state and maths,
// so the scene, the map buttons and the keys all drive the same object.
//
// Motion, like a map: a drag moves across the galaxy with what's under the pointer staying under it, and a release
// glides on; the wheel zooms toward the pointer; turning is a right-drag or a modifier-drag. Zoom-to, fit and fly-to are critically
// damped springs from wherever the camera is now, so any new input interrupts them. Left alone for a while, the camera
// drifts round whatever it's looking at. With reduced motion every change is a jump and nothing drifts or glides.

export type Vec3 = [number, number, number];

export const FOV = 50; // vertical, degrees
const SPRING_S = 0.7; // s, spring response
const W = (2 * Math.PI) / SPRING_S;
const AUTO_SPEED = (2 * Math.PI) / 105; // rad/s: one turn in 105 s
const IDLE_RESUME = 20; // s without input before the drift starts: long enough that it never fights someone exploring
const RAD_PER_PX = 0.002; // a 300px drag turns about a third of a circle
const PITCH_LIMIT = 1.35;
const INERTIA_DECAY = 3.2; // per s

type Goal = { dist: number; target: Vec3 };

// How crisp the stars are drawn, 0 to 1, from how far in the camera is: soft glow over the whole map (below 1.3x),
// separate sharp points once a cloud fills the view (3.5x and in). A cloud's label flies to 2.2x, about halfway.
const SHARP_FROM = 1.3;
const SHARP_AT = 3.5;
export function sharpness(zoomOverFit: number) {
  const t = Math.min(1, Math.max(0, Math.log(zoomOverFit / SHARP_FROM) / Math.log(SHARP_AT / SHARP_FROM)));
  return t * t * (3 - 2 * t);
}

// Whether a drag starting with this pointer-down turns the camera rather than moving across the map: a right-drag
// (like map apps) or a modifier-drag; and while a project is held, a plain drag circles it too.
export const RIGHT_BUTTON = 2;
export function dragTurns(e: { button: number; altKey: boolean; ctrlKey: boolean; metaKey: boolean }, held: boolean) {
  return e.button === RIGHT_BUTTON || e.altKey || e.ctrlKey || e.metaKey || (held && e.button === 0);
}

export class Orbit {
  yaw = 0.7;
  pitch = 0.38;
  dist = 2;
  target: Vec3 = [0, 0, 0];
  reduced = false;
  dragging = false;
  held = false; // a project is selected: panning does nothing, so it stays centred (turning still circles it)
  fitDist = 2;
  private radius = 0.55; // the galaxy's radius for framing (positions sit inside a unit cube centred on 0)
  private aspect = { width: 1, height: 1 };
  private placed = false;
  private goal: Goal | null = null;
  private vDist = 0; // spring velocity of log(dist)
  private vTarget: Vec3 = [0, 0, 0];
  private vPan: Vec3 = [0, 0, 0]; // release glide of the target, world units/s
  private vYaw = 0; // release inertia, rad/s
  private vPitch = 0;
  private idle = 0;
  private auto = 0; // current drift speed, eases toward AUTO_SPEED

  // The canvas size: the galaxy's sphere fits the narrower of the two fields of view.
  setAspect(width: number, height: number) {
    this.aspect = { width, height };
    const over = this.placed ? this.dist / this.fitDist : 1;
    const v = (FOV * Math.PI) / 360;
    const h = Math.atan(Math.tan(v) * (Math.max(width, 1) / Math.max(height, 1)));
    this.fitDist = this.radius / Math.sin(Math.min(v, h));
    this.dist = this.fitDist * over;
    this.placed = true;
  }

  // A new layout's size. A camera framing the whole galaxy eases to frame the new one; a closer look stays put.
  setRadius(r: number) {
    const framing = !this.goal && Math.abs(Math.log(this.zoomOverFit)) < 0.25 && Math.hypot(...this.target) < 0.05;
    const dist = this.dist;
    this.radius = r;
    this.setAspect(this.aspect.width, this.aspect.height);
    this.dist = dist;
    if (framing) this.animateTo({ dist: this.fitDist, target: [0, 0, 0] });
  }

  get minDist() {
    return this.fitDist * 0.06;
  }
  get maxDist() {
    return this.fitDist * 2.4;
  }
  // How far in from the whole-galaxy view (1 = fit).
  get zoomOverFit() {
    return this.fitDist / this.dist;
  }
  get sharp() {
    return sharpness(this.zoomOverFit);
  }
  get moving() {
    return this.goal !== null || this.dragging || Math.abs(this.vYaw) + Math.abs(this.vPitch) > 1e-3 || Math.hypot(...this.vPan) > 1e-4;
  }
  private clampDist(d: number) {
    return Math.min(this.maxDist, Math.max(this.minDist, d));
  }

  // Any input: the drift stops and waits for the map to be left alone again.
  poke() {
    this.idle = 0;
  }
  // Grabbing the map stops whatever the camera was doing, where it is.
  interrupt() {
    this.poke();
    this.goal = null;
    this.vDist = this.vYaw = this.vPitch = 0;
    this.vTarget = [0, 0, 0];
    this.vPan = [0, 0, 0];
    this.auto = 0;
  }

  rotateBy(dxPx: number, dyPx: number) {
    this.yaw -= dxPx * RAD_PER_PX;
    this.pitch = Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, this.pitch + dyPx * RAD_PER_PX));
  }
  // The camera's axes: right and up on screen, and forward into it.
  private basis() {
    const [sy, cy, sp, cp] = [Math.sin(this.yaw), Math.cos(this.yaw), Math.sin(this.pitch), Math.cos(this.pitch)];
    const right: Vec3 = [cy, 0, -sy];
    const up: Vec3 = [-sp * sy, cp, -sp * cy];
    const forward: Vec3 = [-cp * sy, -sp, -cp * cy];
    return { right, up, forward };
  }
  // How far in front of the camera a point is: the depth a drag or zoom should grab it at.
  depthOf(p: ArrayLike<number>) {
    const { forward } = this.basis();
    const e = this.eye();
    return Math.max(this.minDist * 0.5, (p[0] - e[0]) * forward[0] + (p[1] - e[1]) * forward[1] + (p[2] - e[2]) * forward[2]);
  }
  // World units per screen pixel at the target's depth.
  private unitsPerPx(heightPx: number) {
    return (2 * this.dist * Math.tan((FOV * Math.PI) / 360)) / Math.max(heightPx, 1);
  }
  private screenToWorld(dxPx: number, dyPx: number, heightPx: number): Vec3 {
    const { right, up } = this.basis();
    const k = this.unitsPerPx(heightPx);
    return [0, 1, 2].map((a) => (dxPx * right[a] - dyPx * up[a]) * k) as Vec3;
  }

  // A drag: what's under the pointer stays under it, at its depth (the target's when nothing is grabbed). Held while
  // a project is selected.
  panBy(dxPx: number, dyPx: number, heightPx: number, depth = this.dist) {
    if (this.held) return;
    const d = this.screenToWorld(dxPx, dyPx, heightPx).map((v) => (v * depth) / this.dist) as Vec3;
    this.target = this.target.map((t, a) => t - d[a]) as Vec3;
  }
  // Letting go of a drag: the map glides on and slows, like a scroll view.
  releasePan(vxPx: number, vyPx: number, heightPx: number, depth = this.dist) {
    if (this.reduced || this.held) return;
    this.vPan = this.screenToWorld(-vxPx, -vyPx, heightPx).map((v) => (v * depth) / this.dist) as Vec3;
  }
  release(vxPx: number, vyPx: number) {
    if (this.reduced) return;
    this.vYaw = -vxPx * RAD_PER_PX;
    this.vPitch = vyPx * RAD_PER_PX;
  }
  // Wheel and pinch: immediate, toward the point under the pointer (offset from the screen centre in pixels, at its
  // depth), so whatever you point at stays put as it grows. Held on a selected project, it zooms on that project.
  dollyBy(factor: number, at?: { dxPx: number; dyPx: number; heightPx: number; depth?: number }) {
    this.poke();
    this.goal = null;
    this.vDist = 0;
    this.vPan = [0, 0, 0];
    const dist = this.clampDist(this.dist / factor);
    if (at && !this.held) {
      // The camera moves its share of the way toward that point, keeping its direction, so the point's direction
      // from the camera (its place on screen) doesn't change; the target sits the new distance ahead.
      const { forward } = this.basis();
      const depth = at.depth ?? this.dist;
      const off = this.screenToWorld(at.dxPx, at.dyPx, at.heightPx);
      const toward = forward.map((f, a) => f * depth + (off[a] * depth) / this.dist);
      const share = 1 - dist / this.dist;
      const eye = this.eye();
      this.target = eye.map((e, a) => e + toward[a] * share + forward[a] * dist) as Vec3;
    }
    this.dist = dist;
  }

  // Spring to a framing (map buttons, keyboard, fly-to). Reduced motion jumps.
  animateTo(g: Partial<Goal>) {
    this.poke();
    const to: Goal = { dist: this.clampDist(g.dist ?? this.goal?.dist ?? this.dist), target: g.target ?? this.goal?.target ?? this.target };
    if (this.reduced) {
      this.interrupt();
      this.dist = to.dist;
      this.target = [...to.target];
      return;
    }
    this.goal = to;
  }
  zoomBy(factor: number) {
    this.animateTo({ dist: (this.goal?.dist ?? this.dist) / factor });
  }
  fit() {
    this.animateTo({ dist: this.fitDist, target: [0, 0, 0] });
  }
  flyTo(p: Vec3) {
    this.animateTo({ target: p, dist: Math.min(this.dist, this.fitDist * 0.32) });
  }
  // A group of points, centred and framed whole with a margin: the idea scan's flight to an idea and its neighbours.
  frameGroup(center: Vec3, radius: number) {
    const v = (FOV * Math.PI) / 360;
    const h = Math.atan(Math.tan(v) * (Math.max(this.aspect.width, 1) / Math.max(this.aspect.height, 1)));
    const dist = (Math.max(radius, 0.02) * 1.6) / Math.sin(Math.min(v, h));
    this.animateTo({ target: center, dist: Math.min(this.fitDist * 0.9, Math.max(this.fitDist * 0.16, dist)) });
  }
  // A category's cloud: framed whole, a little closer than the galaxy.
  flyToCloud(p: Vec3) {
    this.animateTo({ target: p, dist: this.fitDist * 0.45 });
  }

  // Advance by dt seconds.
  step(dt: number) {
    if (dt <= 0) return;
    if (!this.dragging) this.idle += dt;
    const drift = !this.reduced && this.idle > IDLE_RESUME ? AUTO_SPEED : 0;
    this.auto += (drift - this.auto) * (1 - Math.exp(-dt * 0.8));
    this.yaw += this.auto * dt;
    if (!this.dragging) {
      this.yaw += this.vYaw * dt;
      this.pitch = Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, this.pitch + this.vPitch * dt));
      const k = Math.exp(-dt * INERTIA_DECAY);
      this.vYaw *= k;
      this.vPitch *= k;
      this.target = this.target.map((t, a) => t + this.vPan[a] * dt) as Vec3;
      this.vPan = this.vPan.map((v) => v * k) as Vec3;
    }
    const g = this.goal;
    if (!g) return;
    // Critically damped, distance in log space so zooming in and out feel the same; small substeps so a long frame
    // can't overshoot.
    for (let left = dt; left > 0; left -= 1 / 240) {
      const h = Math.min(left, 1 / 240);
      const ld = Math.log(this.dist);
      this.vDist += (-W * W * (ld - Math.log(g.dist)) - 2 * W * this.vDist) * h;
      this.dist = Math.exp(ld + this.vDist * h);
      for (let a = 0; a < 3; a++) {
        this.vTarget[a] += (-W * W * (this.target[a] - g.target[a]) - 2 * W * this.vTarget[a]) * h;
        this.target[a] += this.vTarget[a] * h;
      }
    }
    const off = Math.abs(Math.log(this.dist / g.dist)) + Math.hypot(...this.target.map((v, a) => v - g.target[a]));
    if (off < 1e-4) {
      this.dist = g.dist;
      this.target = [...g.target];
      this.goal = null;
      this.vDist = 0;
      this.vTarget = [0, 0, 0];
    }
  }

  // Where the camera sits.
  eye(): Vec3 {
    const c = Math.cos(this.pitch);
    return [this.target[0] + this.dist * c * Math.sin(this.yaw), this.target[1] + this.dist * Math.sin(this.pitch), this.target[2] + this.dist * c * Math.cos(this.yaw)];
  }
}
