// The twins' chimes (specs/features/idea-scan, Plan 5): a soft struck bar per twin, rising (E5, G#5), the third a short
// cascade up the same chord. Synthesized with WebAudio: three sine partials at a free bar's mode ratios, each with its
// own decay, so no audio file ships. Quiet by default: it plays through a presenter's laptop speakers.

const VOLUME = 0.07;
const PARTIALS = [
  { ratio: 1, gain: 1, decay: 1.8 },
  { ratio: 2.756, gain: 0.28, decay: 0.6 },
  { ratio: 5.404, gain: 0.08, decay: 0.25 },
];
const NOTES = [659.25, 830.61]; // E5, G#5
const CASCADE = [987.77, 1318.51, 1661.22, 1975.53]; // B5, E6, G#6, B6

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let muted = false;

// Call from a user gesture (the story's play): browsers only let an AudioContext start inside one.
export function wake() {
  if (typeof AudioContext === "undefined") return;
  if (!ctx) {
    ctx = new AudioContext();
    out = ctx.createGain();
    out.gain.value = VOLUME;
    out.connect(ctx.destination);
  }
  void ctx.resume();
}

export const toggleMute = () => (muted = !muted);

function strike(f: number, at: number, level: number) {
  if (!ctx || !out) return;
  for (const p of PARTIALS) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.frequency.value = f * p.ratio;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level * p.gain, at + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, at + p.decay);
    osc.connect(env).connect(out);
    osc.start(at);
    osc.stop(at + p.decay + 0.05);
  }
}

// Twin k reached (0, 1, 2).
export function chime(k: number) {
  if (!ctx || muted) return;
  const at = ctx.currentTime + 0.01;
  if (k < NOTES.length) strike(NOTES[k], at, 1);
  else CASCADE.forEach((f, i) => strike(f, at + i * 0.075, i === 0 ? 1 : 0.6));
}
