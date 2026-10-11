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

// The schema checks each star with a plain loop that mirrors `Star` above (keep them in step: tests/galaxy-3d pins
// the two against each other); zod on every star took ~250 ms of a 100k-star load at 4x CPU and built a copy of each.
// A star the loop rejects goes through zod, so the error says what was wrong.
const Head = Stars.extend({ stars: z.array(z.unknown()) });
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v); // z.number() refuses NaN and Infinity
const nullish = (v: unknown, ok: (v: unknown) => boolean) => v == null || ok(v);
export const isStar = (s: unknown): s is Star => {
  const o = s as Record<string, unknown> | null;
  return (
    typeof o === "object" && o !== null && typeof o.id === "string" && num(o.x) && num(o.y) && num(o.z) &&
    typeof o.title === "string" && nullish(o.event, (v) => typeof v === "string") && nullish(o.year, num)
  );
};
export function parseStars(data: unknown): StarsFile {
  const head = Head.parse(data);
  for (const s of head.stars) if (!isStar(s)) Star.parse(s);
  return head as StarsFile;
}

// One fetch and one parse per page, shared by the galaxy and search, which each used to fetch and parse their own copy.
// A failure isn't cached, so the next caller tries again.
export type StarsLoad = { state: "ready"; data: StarsFile } | { state: "missing"; reason?: string };
let starsLoad: Promise<StarsLoad> | null = null;
export function loadStars(): Promise<StarsLoad> {
  starsLoad ??= fetch("/corpus/stars.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((json): StarsLoad => {
      if (!json) return { state: "missing" };
      try {
        return { state: "ready", data: parseStars(json) };
      } catch {
        return { state: "missing", reason: "stars.json is invalid" };
      }
    })
    .catch((): StarsLoad => ({ state: "missing" }))
    .then((l) => ((starsLoad = l.state === "ready" ? starsLoad : null), l));
  return starsLoad;
}

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

// Zoomed in, the stars nearest the map's centre are named. `screen` holds x, y, farness per star in CSS pixels
// (NaN = hidden, behind the camera or off the map; farness 0 near side, 1 far side). Nearest the centre first; a name
// that would overlap one already placed, or a box in `taken` (the cloud names), is skipped, so at most `max` names,
// none covering another.
export const NAME_MAX = 10;
const NAME_CHARS = 28;
export const shortTitle = (t: string) => (t.length > NAME_CHARS ? `${t.slice(0, NAME_CHARS - 1).trimEnd()}…` : t);
const NAME_PX_PER_CHAR = 6.6; // the label's mono text, measured at --text-xs
type Box = { x0: number; x1: number; y0: number; y1: number };
// A name has to point at one dot: a star with another drawn within this many pixels of it isn't named, so over a dense
// field nothing is, and as the camera closes in names arrive first on the stars that stand apart.
export const NAME_ISOLATION = 16; // CSS px
export function nearestNames(screen: Float32Array, titles: readonly string[], cx: number, cy: number, taken: Box[] = [], max = NAME_MAX, isolation = NAME_ISOLATION): number[] {
  const order: number[] = [];
  for (let i = 0; i < titles.length; i++) if (screen[3 * i + 2] < 0.6) order.push(i); // NaN fails too
  // Every drawn star (either side) in a grid of `isolation`-sized cells, so a neighbour check looks at 9 cells.
  const grid = new Map<number, number[]>();
  const cell = (x: number, y: number) => Math.floor(x / isolation) * 100003 + Math.floor(y / isolation);
  for (let i = 0; i < titles.length; i++) {
    const [x, y] = [screen[3 * i], screen[3 * i + 1]];
    if (Number.isNaN(x)) continue;
    const k = cell(x, y);
    const bucket = grid.get(k);
    if (bucket) bucket.push(i);
    else grid.set(k, [i]);
  }
  const alone = (i: number) => {
    const [x, y] = [screen[3 * i], screen[3 * i + 1]];
    const [gx, gy] = [Math.floor(x / isolation), Math.floor(y / isolation)];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const j of grid.get((gx + dx) * 100003 + gy + dy) ?? [])
          if (j !== i && (screen[3 * j] - x) ** 2 + (screen[3 * j + 1] - y) ** 2 < isolation * isolation) return false;
    return true;
  };
  const d = (i: number) => (screen[3 * i] - cx) ** 2 + (screen[3 * i + 1] - cy) ** 2;
  order.sort((a, b) => d(a) - d(b));
  const placed = [...taken];
  const out: number[] = [];
  for (const i of order) {
    if (out.length >= max) break;
    if (!alone(i)) continue;
    const [x, y] = [screen[3 * i], screen[3 * i + 1]];
    const box = { x0: x - 4, x1: x + 14 + shortTitle(titles[i]).length * NAME_PX_PER_CHAR, y0: y - 10, y1: y + 10 };
    if (placed.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
    placed.push(box);
    out.push(i);
  }
  return out;
}

// `year` is the project's created year, not its event date (changes/corpus-embed.md), so it's always labelled that way.
export const createdLabel = (year?: number | null) => (year == null ? "date unknown" : `created ${year}`);

export const yearsOf = (stars: { year?: number | null }[]) =>
  [...new Set(stars.flatMap((s) => (s.year == null ? [] : [s.year])))].sort((a, b) => a - b);

// 1 = shown. No reveal year shows everything; a star with no year is never hidden.
export function revealMask(stars: { year?: number | null }[], reveal: number | null) {
  return Uint8Array.from(stars, (s) => (reveal === null || s.year == null || s.year <= reveal ? 1 : 0));
}
