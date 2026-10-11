// The idea scan and the intro (specs/features/idea-scan): one clock that the scene reads every frame (shader uniforms,
// arcs, tags, the camera) and the readout reads on each event (phase, arcs landed, clouds lit). Pure state and maths,
// no DOM or three.js, so the timing is unit-tested.
//
// Scan: the field drains to grey while the camera flies in; then, closest first, one arc at a time reaches a stored
// neighbour, which lights with its whole category cloud; then the rest of the field settles into today's idea focus.
// Intro: the field starts grey and each category cloud lights in turn, largest first, then the camera pulls back.

export const SLOTS = 24; // category slots in the star shader (16 used: 14 domains, mixed, not enough text)
export const ARCS = 8; // neighbour slots (an idea stores 5)

// Seconds. Tuned by eye: long enough to read each landing, short enough that five land in under three seconds.
export const SCAN = { drain: 0.55, reachAt: 0.85, gap: 0.42, reach: 0.62, warm: 0.8, settle: 0.9 } as const;
export const INTRO = { start: 0.5, gap: 0.3, warm: 0.75, hold: 0.5 } as const;

export type ScanPhase = "idle" | "drain" | "reach" | "settle" | "done";
export type IntroPhase = "idle" | "play" | "done";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

// When neighbour k's arc lands, from the scan's start.
export const landAt = (k: number) => SCAN.reachAt + k * SCAN.gap + SCAN.reach;
export const scanLength = (n: number) => (n > 0 ? landAt(n - 1) : SCAN.reachAt) + SCAN.settle;
export const introLength = (m: number) => INTRO.start + Math.max(0, m - 1) * INTRO.gap + INTRO.warm + INTRO.hold;

// Everything the scene needs for one frame.
export type Frame = {
  drain: number; // 0..1: how far unlit stars are drained to grey
  fade: number; // 0..1: how far non-neighbours have dimmed toward the idea focus (the settle)
  warm: Float32Array; // per category slot, 0..1: lit back toward its colour
  reach: Float32Array; // per neighbour, 0..1: how much of its arc is drawn
  land: Float32Array; // per neighbour, seconds since its arc landed (-1 = not yet)
};

export function scanPhase(t: number, n: number): ScanPhase {
  if (t < SCAN.reachAt) return "drain";
  if (n > 0 && t < landAt(n - 1)) return "reach";
  if (t < scanLength(n)) return "settle";
  return "done";
}

export function landedAt(t: number, n: number) {
  let k = 0;
  while (k < n && t >= landAt(k)) k++;
  return k;
}

// The scan at t seconds: n neighbours, cats[k] the category slot of neighbour k (-1 = unknown).
export function scanFrame(t: number, cats: number[], out: Frame = emptyFrame()): Frame {
  const n = Math.min(cats.length, ARCS);
  const settleAt = scanLength(n) - SCAN.settle;
  const settle = smooth((t - settleAt) / SCAN.settle);
  out.drain = smooth(t / SCAN.drain) * (1 - settle);
  out.fade = settle;
  out.warm.fill(0);
  out.reach.fill(0);
  out.land.fill(-1);
  for (let k = 0; k < n; k++) {
    out.reach[k] = easeOut((t - (SCAN.reachAt + k * SCAN.gap)) / SCAN.reach);
    const since = t - landAt(k);
    if (since >= 0) out.land[k] = since;
    const c = cats[k];
    if (c >= 0 && c < SLOTS) out.warm[c] = Math.max(out.warm[c], smooth(since / SCAN.warm));
  }
  if (t >= scanLength(n)) return settledFrame(out);
  return out;
}

// The intro at t seconds: order[j] is the j-th category slot to light.
export function introFrame(t: number, order: number[], out: Frame = emptyFrame()): Frame {
  out.fade = 0;
  out.reach.fill(0);
  out.land.fill(-1);
  out.warm.fill(0);
  order.forEach((c, j) => {
    if (c >= 0 && c < SLOTS) out.warm[c] = smooth((t - INTRO.start - j * INTRO.gap) / INTRO.warm);
  });
  out.drain = t >= introLength(order.length) ? 0 : 1;
  return out;
}

export function introLit(t: number, m: number) {
  let j = 0;
  while (j < m && t >= INTRO.start + j * INTRO.gap + INTRO.warm * 0.4) j++;
  return j;
}

export const emptyFrame = (): Frame => ({ drain: 0, fade: 0, warm: new Float32Array(SLOTS), reach: new Float32Array(ARCS), land: new Float32Array(ARCS).fill(-1) });

// At rest: nothing drained, every arc drawn and landed long ago.
function settledFrame(out: Frame): Frame {
  out.drain = 0;
  out.fade = 0;
  out.warm.fill(0);
  out.reach.fill(1);
  out.land.fill(99);
  return out;
}

export type Status = { scan: ScanPhase; landed: number; intro: IntroPhase; lit: number; key: string | null };

// The clock. The scene calls tick() each frame; listeners hear about each change of phase or count.
export class Director {
  reduced = false;
  private mode: "scan" | "intro" | null = null;
  private start = 0;
  private cats: number[] = [];
  private order: number[] = [];
  private queued: { key: string; cats: number[] } | null = null;
  private frameBuf = emptyFrame();
  private listeners = new Set<(s: Status) => void>();
  // Set when a scan starts: the scene frames the idea and its neighbours with the camera, then clears it.
  needsFraming = false;
  // Set when the intro starts and ends: the scene sets the camera, then clears it.
  introCamera: "start" | "end" | null = null;
  status: Status = { scan: "idle", landed: 0, intro: "idle", lit: 0, key: null };

  subscribe(fn: (s: Status) => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
  private emit(patch: Partial<Status>) {
    const next = { ...this.status, ...patch };
    if (Object.keys(patch).every((k) => next[k as keyof Status] === this.status[k as keyof Status])) return;
    this.status = next;
    this.listeners.forEach((l) => l(next));
  }

  get playing() {
    return this.mode !== null;
  }

  // Play the scan for the idea `key` (its version id). During the intro it waits for the intro to end.
  startScan(key: string, cats: number[], now: number) {
    if (this.mode === "intro") {
      this.queued = { key, cats };
      return;
    }
    this.cats = cats.slice(0, ARCS);
    if (this.reduced) {
      this.mode = null;
      this.emit({ scan: "done", landed: this.cats.length, key });
      return;
    }
    this.mode = "scan";
    this.start = now;
    this.needsFraming = true;
    this.emit({ scan: "drain", landed: 0, key });
  }

  startIntro(order: number[], now: number) {
    if (this.reduced) return this.emit({ intro: "done", lit: order.length });
    this.order = order;
    this.mode = "intro";
    this.start = now;
    this.introCamera = "start";
    this.emit({ intro: "play", lit: 0 });
  }

  // Any input: whatever is playing ends where it would have ended.
  skip(now: number) {
    if (this.mode === "intro") this.endIntro(now);
    if (this.mode === "scan") {
      this.mode = null;
      this.needsFraming = false;
      this.emit({ scan: "done", landed: this.cats.length });
    }
  }

  private endIntro(now: number) {
    this.mode = null;
    this.introCamera = "end";
    this.emit({ intro: "done", lit: this.order.length });
    const q = this.queued;
    this.queued = null;
    if (q) this.startScan(q.key, q.cats, now);
  }

  // The frame at `now` (seconds), or null when nothing is playing (the scene draws its resting state).
  tick(now: number): Frame | null {
    const t = now - this.start;
    if (this.mode === "scan") {
      const n = this.cats.length;
      const phase = scanPhase(t, n);
      this.emit({ scan: phase, landed: landedAt(t, n) });
      if (phase === "done") {
        this.mode = null;
        return null;
      }
      return scanFrame(t, this.cats, this.frameBuf);
    }
    if (this.mode === "intro") {
      this.emit({ lit: introLit(t, this.order.length) });
      if (t >= introLength(this.order.length)) {
        this.endIntro(now);
        return null;
      }
      return introFrame(t, this.order, this.frameBuf);
    }
    return null;
  }
}
