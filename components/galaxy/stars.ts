import { z } from "zod";

// public/corpus/stars.json, written by corpus-embed (specs/features/corpus-embed/spec.md).
const Star = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  title: z.string(),
  event: z.string().nullish(),
  year: z.number().nullish(),
});
const Stars = z.object({ corpus_version: z.string(), count: z.number(), stars: z.array(Star) });

export type Star = z.infer<typeof Star>;
export type StarsFile = z.infer<typeof Stars>;

export const parseStars = (data: unknown): StarsFile => Stars.parse(data);

// Colour is always paired with size, so no state relies on colour alone.
export const STYLE = {
  base: { color: [0.62, 0.68, 0.8], size: 3 },
  highlighted: { color: [0.96, 0.71, 0.29], size: 7 }, // --uncertain amber
  selected: { color: [1, 1, 1], size: 10 },
  idea: { color: [0.31, 0.84, 0.91], size: 12 }, // --idea cyan
  activeIdea: { color: [0.31, 0.84, 0.91], size: 16 },
  // A prize winner: bigger than base and drawn with a ring (Scene.tsx), so the mark is a shape, not colour alone.
  prize: { color: [0.62, 0.68, 0.8], size: 6 },
} as const;

export function styleFor(id: string, selectedId: string | null, highlighted: ReadonlySet<string>) {
  if (id === selectedId) return STYLE.selected;
  if (highlighted.has(id)) return STYLE.highlighted;
  return STYLE.base;
}

// Points are drawn at a fixed pixel size, so hit-testing happens in screen pixels, not with a world-space
// raycast threshold that would drift with zoom. `screen` holds x,y pairs in CSS pixels (NaN = behind camera).
// ponytail: linear scan per pointer event; fine for tens of thousands of stars, add a grid if it ever lags.
export function pickNearest(screen: Float32Array, px: number, py: number, radius: number): number {
  let best = -1;
  let bestD = radius * radius;
  for (let i = 0; i < screen.length / 2; i++) {
    const dx = screen[2 * i] - px;
    const dy = screen[2 * i + 1] - py;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

// `year` is the project's created year, not its event date (changes/corpus-embed.md), so it's always labelled that way.
export const createdLabel = (year?: number | null) => (year == null ? "date unknown" : `created ${year}`);

export const yearsOf = (stars: { year?: number | null }[]) =>
  [...new Set(stars.flatMap((s) => (s.year == null ? [] : [s.year])))].sort((a, b) => a - b);

// 1 = shown. No reveal year shows everything; a star with no year is never hidden.
export function revealMask(stars: { year?: number | null }[], reveal: number | null) {
  return Uint8Array.from(stars, (s) => (reveal === null || s.year == null || s.year <= reveal ? 1 : 0));
}
