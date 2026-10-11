// The story (specs/features/idea-scan, Plan 5): the demo video's joke played in the real app for the presenter. One
// clock for the galaxy (camera, scan, selection) and the overlay (bubbles, counter, cards, chimes); both subscribe and
// read the same state, so a pause or a beat skip moves them together. Pure timing, no DOM except the page attribute.

export const BEATS = ["sky", "egg", "twins", "proof", "turn"] as const;
export type Beat = (typeof BEATS)[number];

// Seconds from the story's start. Each beat runs until the next one starts; the story ends at END.
export const BEAT_AT: Record<Beat, number> = { sky: 0, egg: 7, twins: 12, proof: 23, turn: 29 };
export const END = 36;

// When each twin is reached, from the story's start (a chime and its card), and Fred's line after the third.
export const TWIN_AT = [13, 15, 17] as const;
export const COUNT_UP = { from: 0.5, to: 6 } as const; // the sky beat's counter

// Fred's lines: at (seconds from the story's start), text. Copy, not data.
export const LINES: { at: number; beat: Beat; text: string }[] = [
  { at: 1.5, beat: "sky", text: "Every star is a real hackathon project." },
  { at: 7.4, beat: "egg", text: "Say your idea is a new UCF parking app…" },
  { at: 18.6, beat: "twins", text: "Smells familiar." },
  { at: 23.6, beat: "proof", text: "Each one is real. Here's its Devpost." },
  { at: 29.6, beat: "turn", text: "So what hasn't been built yet? Tap me." },
];

// The three twins, matched by exact title and year in stars.json (the video's Act 1 D uses the same three).
export const TWINS = [
  { title: "Knight Parking", year: 2016 },
  { title: "UCF Parking Agent", year: 2019 },
  { title: "UCF Parking", year: 2021 },
] as const;

export type Twin = { index: number; id: string; title: string; event: string | null; year: number | null };

// The twins found in the corpus, in story order. A missing one is skipped, never stood in for.
export function findTwins(stars: { id: string; title: string; event?: string | null; year?: number | null }[]): Twin[] {
  return TWINS.flatMap((w) => {
    const index = stars.findIndex((s) => s.title === w.title && s.year === w.year);
    if (index < 0) return [];
    const s = stars[index];
    return [{ index, id: s.id, title: s.title, event: s.event ?? null, year: s.year ?? null }];
  });
}

export const beatAt = (t: number): Beat => [...BEATS].reverse().find((b) => t >= BEAT_AT[b]) ?? "sky";

// With no twins, the egg, twins and proof beats are skipped: the sky runs into the turn.
export const playable = (twins: number): Beat[] => (twins > 0 ? [...BEATS] : ["sky", "turn"]);

export type StoryState = { playing: boolean; paused: boolean; t: number; beat: Beat | null };

// The presenter's clock. `now` is seconds (performance.now() / 1000). Listeners hear every start, pause, resume, seek
// and stop, not every frame; per-frame readers call state(now).
export class Story {
  private start = 0;
  private pausedAt: number | null = null;
  private active = false;
  private beats: Beat[] = [...BEATS];
  private listeners = new Set<(s: StoryState) => void>();

  subscribe(fn: (s: StoryState) => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
  private emit(now: number) {
    const s = this.state(now);
    if (typeof document !== "undefined") {
      if (s.playing) document.documentElement.dataset.story = s.paused ? "paused" : "play";
      else delete document.documentElement.dataset.story;
    }
    this.listeners.forEach((l) => l(s));
  }

  state(now: number): StoryState {
    if (!this.active) return { playing: false, paused: false, t: 0, beat: null };
    const t = (this.pausedAt ?? now) - this.start;
    return { playing: true, paused: this.pausedAt !== null, t, beat: beatAt(t) };
  }

  play(now: number, twins = TWINS.length) {
    this.beats = playable(twins);
    this.active = true;
    this.pausedAt = null;
    this.start = now;
    this.emit(now);
  }
  toggle(now: number) {
    if (!this.active) return;
    if (this.pausedAt === null) this.pausedAt = now;
    else {
      this.start += now - this.pausedAt;
      this.pausedAt = null;
    }
    this.emit(now);
  }
  // Jump to the start of the next (+1) or previous (-1) playable beat; past the last one, the story ends.
  step(now: number, dir: 1 | -1) {
    const s = this.state(now);
    if (!s.playing || !s.beat) return;
    const i = this.beats.indexOf(s.beat);
    const to = i + dir;
    if (to >= this.beats.length) return this.stop(now);
    this.seek(now, BEAT_AT[this.beats[Math.max(0, to)]]);
  }
  seek(now: number, t: number) {
    const base = this.pausedAt ?? now;
    this.start = base - t;
    this.emit(now);
  }
  stop(now: number) {
    if (!this.active) return;
    this.active = false;
    this.pausedAt = null;
    this.emit(now);
  }
  // Called each frame by the galaxy: ends the story at END, and jumps over beats the corpus can't play.
  tick(now: number) {
    const s = this.state(now);
    if (!s.playing || s.paused) return;
    if (s.t >= END) return this.stop(now);
    if (s.beat && !this.beats.includes(s.beat)) this.seek(now, BEAT_AT[this.beats.find((b) => BEAT_AT[b] > s.t) ?? "turn"]);
  }
}
