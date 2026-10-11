// The 3D galaxy's camera. An orbit around a target point: yaw, pitch and distance. Pure state and maths,
// so the scene, the map buttons and the keys all drive the same object.
//
// Motion: a drag rotates 1:1 and a release keeps its angular velocity, decaying like a scroll view; zoom-to, fit and
// fly-to are critically damped springs that start from wherever the camera is now, so any new input interrupts them.
// When nobody has touched the map for a few seconds the camera drifts round the galaxy, easing in rather than jumping
// to speed. With reduced motion every change is a jump and nothing drifts.

export type Vec3 = [number, number, number];

export const FOV = 50; // vertical, degrees
const SPRING_S = 0.7; // s, spring response
const W = (2 * Math.PI) / SPRING_S;
const AUTO_SPEED = (2 * Math.PI) / 105; // rad/s: one turn in 105 s
const IDLE_RESUME = 3.5; // s without input before the drift starts again
const RAD_PER_PX = 0.005;
const PITCH_LIMIT = 1.35;
const INERTIA_DECAY = 3.2; // per s

type Goal = { dist: number; target: Vec3 };

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
  get moving() {
    return this.goal !== null || this.dragging || Math.abs(this.vYaw) + Math.abs(this.vPitch) > 1e-3;
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
    this.auto = 0;
  }

  rotateBy(dxPx: number, dyPx: number) {
    this.yaw -= dxPx * RAD_PER_PX;
    this.pitch = Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, this.pitch + dyPx * RAD_PER_PX));
  }
  // Right-drag or shift-drag: slide the target across the screen, so what's under the pointer follows it.
  panBy(dxPx: number, dyPx: number, heightPx: number) {
    if (this.held) return;
    const k = (2 * this.dist * Math.tan((FOV * Math.PI) / 360)) / Math.max(heightPx, 1);
    const [sy, cy, sp, cp] = [Math.sin(this.yaw), Math.cos(this.yaw), Math.sin(this.pitch), Math.cos(this.pitch)];
    const right: Vec3 = [cy, 0, -sy];
    const up: Vec3 = [-sp * sy, cp, -sp * cy];
    this.target = this.target.map((t, a) => t - (dxPx * right[a] - dyPx * up[a]) * k) as Vec3;
  }
  release(vxPx: number, vyPx: number) {
    if (this.reduced) return;
    this.vYaw = -vxPx * RAD_PER_PX;
    this.vPitch = vyPx * RAD_PER_PX;
  }
  // Wheel and pinch: immediate, about the target.
  dollyBy(factor: number) {
    this.poke();
    this.goal = null;
    this.vDist = 0;
    this.dist = this.clampDist(this.dist / factor);
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
