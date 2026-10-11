// Every star flies from one layout to the other. The GPU moves the points (GLSL below); the CPU runs the
// same formula into `current`, so picking, labels, idea tentacles and fly-to all see where the stars are drawn.
// `current` is computed when read, at most once per frame: running it every frame of a flight cost ~1.5 s of main
// thread over a 100k-star load (4x CPU), though on most frames nothing reads it.

export const MORPH_S = 1.4;
const SPREAD = 0.4; // share of the morph used to stagger stars: the centre leaves first, the rim last
const BOW = 0.22; // how far a star's path bows outward, per unit travelled
const CORE = 0.04; // the first animated layout bursts out from this share of each star's place: the galaxy is born

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
  seed: Float32Array = new Float32Array(0);
  t = 1;
  private start = 0;
  private live = false;
  private at: Float32Array = new Float32Array(0);
  private atT = NaN; // the t `at` holds

  // Where every star is drawn at the current t.
  get current(): Float32Array {
    if (this.atT !== this.t) this.fill();
    return this.at;
  }

  // Set the layout to show. The first call bursts the stars out from the core (the stagger sends the centre first, the
  // rim last, and the bow curls each path outward), or places them without animation; later calls fly them from
  // wherever they are now, so a second switch mid-flight turns around smoothly.
  set(to: Float32Array, now: number, animate: boolean) {
    const n = to.length / 3;
    if (this.seed.length !== n) this.seed = Float32Array.from({ length: n }, (_, i) => seedOf(i));
    const first = this.to.length === 0;
    this.from =
      this.at.length === to.length && animate
        ? Float32Array.from(this.current)
        : first && animate
          ? to.map((v) => v * CORE)
          : Float32Array.from(to);
    this.to = to;
    this.at = new Float32Array(to.length);
    this.atT = NaN;
    this.start = now;
    this.t = animate ? 0 : 1;
    this.live = true;
    this.step(now);
  }

  // Advance to `now` (seconds). Returns whether the stars moved.
  step(now: number) {
    if (!this.live) return false;
    this.t = Math.min(1, Math.max(0, (now - this.start) / MORPH_S));
    if (this.t >= 1) this.live = false;
    return true;
  }

  private fill() {
    const { from, to, at, seed, t } = this;
    this.atT = t;
    if (t >= 1) {
      at.set(to);
      return;
    }
    for (let i = 0; i < seed.length; i++) {
      const x = 3 * i;
      const [tx, ty, tz] = [to[x], to[x + 1], to[x + 2]];
      const [fx, fy, fz] = [from[x], from[x + 1], from[x + 2]];
      const delay = SPREAD * (0.55 * seed[i] + 0.45 * Math.min(1, Math.sqrt(tx * tx + ty * ty + tz * tz) / 0.6));
      const k = ease(Math.min(1, Math.max(0, (t - delay) / (1 - SPREAD))));
      const bow = Math.sin(k * Math.PI) * BOW * Math.sqrt((tx - fx) ** 2 + (ty - fy) ** 2 + (tz - fz) ** 2);
      const px = fx + (tx - fx) * k;
      const py = fy + (ty - fy) * k;
      const pz = fz + (tz - fz) * k;
      const s = bow / (Math.sqrt(px * px + py * py + pz * pz) || 1);
      at[x] = px + px * s;
      at[x + 1] = py + py * s;
      at[x + 2] = pz + pz * s;
    }
  }
}
