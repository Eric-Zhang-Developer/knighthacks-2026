// Every star flies from one layout to the other. The GPU moves the points (GLSL below); the CPU runs the
// same formula into `current`, so picking, labels, idea tentacles and fly-to all see where the stars are drawn.

export const MORPH_S = 1.4;
const SPREAD = 0.4; // share of the morph used to stagger stars: the centre leaves first, the rim last
const BOW = 0.22; // how far a star's path bows outward, per unit travelled

export const seedOf = (i: number) => {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const easeInOut = ease;

export const MORPH_GLSL = /* glsl */ `
  attribute vec3 aFrom;
  attribute float seed;
  uniform float uMorph;
  vec3 morphed() {
    float delay = ${SPREAD.toFixed(3)} * (0.55 * seed + 0.45 * min(1.0, length(position) / 0.6));
    float k = clamp((uMorph - delay) / ${(1 - SPREAD).toFixed(3)}, 0.0, 1.0);
    k = k < 0.5 ? 4.0 * k * k * k : 1.0 - pow(-2.0 * k + 2.0, 3.0) / 2.0;
    vec3 p = mix(aFrom, position, k);
    return p + normalize(p + vec3(1e-4)) * sin(k * 3.14159265) * ${BOW.toFixed(3)} * distance(aFrom, position);
  }`;

export class Morph {
  from: Float32Array = new Float32Array(0);
  to: Float32Array = new Float32Array(0);
  current: Float32Array = new Float32Array(0);
  seed: Float32Array = new Float32Array(0);
  t = 1;
  private start = 0;
  private live = false;

  // Set the layout to show. The first call places the stars; later calls fly them from wherever they are now, so a
  // second switch mid-flight turns around smoothly.
  set(to: Float32Array, now: number, animate: boolean) {
    const n = to.length / 3;
    if (this.seed.length !== n) this.seed = Float32Array.from({ length: n }, (_, i) => seedOf(i));
    this.from = this.current.length === to.length && animate ? Float32Array.from(this.current) : Float32Array.from(to);
    this.to = to;
    this.current = Float32Array.from(this.from);
    this.start = now;
    this.t = this.from === to || !animate ? 1 : 0;
    this.live = true;
    this.step(now);
  }

  // Advance to `now` (seconds). Returns whether the stars moved.
  step(now: number) {
    if (!this.live) return false;
    this.t = Math.min(1, Math.max(0, (now - this.start) / MORPH_S));
    const { from, to, current, seed } = this;
    for (let i = 0; i < seed.length; i++) {
      const x = 3 * i;
      const delay = SPREAD * (0.55 * seed[i] + 0.45 * Math.min(1, Math.hypot(to[x], to[x + 1], to[x + 2]) / 0.6));
      const k = ease(Math.min(1, Math.max(0, (this.t - delay) / (1 - SPREAD))));
      const bow = Math.sin(k * Math.PI) * BOW * Math.hypot(to[x] - from[x], to[x + 1] - from[x + 1], to[x + 2] - from[x + 2]);
      let px = from[x] + (to[x] - from[x]) * k;
      let py = from[x + 1] + (to[x + 1] - from[x + 1]) * k;
      let pz = from[x + 2] + (to[x + 2] - from[x + 2]) * k;
      const len = Math.hypot(px, py, pz) || 1;
      px += (px / len) * bow;
      py += (py / len) * bow;
      pz += (pz / len) * bow;
      current[x] = px;
      current[x + 1] = py;
      current[x + 2] = pz;
    }
    if (this.t >= 1) this.live = false;
    return true;
  }
}
