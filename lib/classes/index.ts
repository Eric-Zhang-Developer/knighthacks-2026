import { useSyncExternalStore } from "react";
import { z } from "zod";

// public/classify/classes.json, written by corpus-classify (specs/features/corpus-classify/spec.md, contract in #269).
const Prize = z.object({
  event: z.string().nullable(),
  text: z.string(),
  kind: z.enum(["placement", "sponsor", "category", "participation", "other"]),
  place: z.number().int().min(1).max(3).nullable(),
  sponsor: z.string().nullable(),
});
const Project = z.object({
  domain: z.string().nullable(),
  status: z.enum(["clear", "mixed", "insufficient_text"]),
  runner_up: z.string().nullable().optional(),
  prizes: z.array(Prize),
});
const Classes = z.object({
  corpus_version: z.string(),
  domains: z.array(z.object({ id: z.string(), label: z.string() })).min(1),
  projects: z.record(z.string(), Project),
});

export type Prize = z.infer<typeof Prize>;
export type ProjectClass = z.infer<typeof Project>;
export type ClassesFile = z.infer<typeof Classes>;
export type Load = { state: "loading" } | { state: "missing"; reason: string } | { state: "ready"; data: ClassesFile };

// A file for another corpus would colour the wrong stars, so it's refused rather than half-applied.
export function parseClasses(json: unknown, corpusVersion: string): Load {
  const parsed = Classes.safeParse(json);
  if (!parsed.success) return { state: "missing", reason: "classes.json is invalid" };
  if (parsed.data.corpus_version !== corpusVersion) return { state: "missing", reason: "classes.json is for another corpus" };
  return { state: "ready", data: parsed.data };
}

// Muted hues for the dark map, in the file's domain order; a 15th domain would reuse the first hue.
// Each clears 3:1 against --bg (tests/galaxy-classes-ui checks it), and colour always has a label beside it.
export const PALETTE = [
  [0.86, 0.47, 0.55], [0.47, 0.71, 0.92], [0.91, 0.72, 0.41], [0.45, 0.8, 0.6], [0.72, 0.58, 0.93],
  [0.93, 0.6, 0.38], [0.4, 0.78, 0.82], [0.85, 0.82, 0.48], [0.62, 0.84, 0.43], [0.93, 0.55, 0.78],
  [0.56, 0.62, 0.95], [0.78, 0.68, 0.55], [0.5, 0.86, 0.75], [0.95, 0.66, 0.6],
] as const;
export const NEUTRAL = [0.5, 0.53, 0.6] as const; // mixed and not enough text
export const MIXED = "mixed";
export const UNCLEAR = "insufficient_text";

// The legend key a project falls under: its domain, or mixed / not enough text.
export const keyOf = (c: ProjectClass | undefined) => (!c ? null : c.status === "clear" ? c.domain : c.status === "mixed" ? MIXED : UNCLEAR);

export function colourOf(data: ClassesFile, c: ProjectClass | undefined): readonly number[] | null {
  const key = keyOf(c);
  if (key === null) return null;
  const i = data.domains.findIndex((d) => d.id === key);
  return i < 0 ? NEUTRAL : PALETTE[i % PALETTE.length];
}

// Only placement and sponsor prizes are wins; participation certificates and the like aren't. With an event filter,
// only that event's prizes count.
export const wins = (c: ProjectClass | undefined, event?: string | null) =>
  (c?.prizes ?? []).filter((p) => (p.kind === "placement" || p.kind === "sponsor") && (!event || p.event === event));

// One filter for the legend and the search selects. `prize`: "" any project, "win" any placement or sponsor prize,
// "1"/"2"/"3" that placement, "sponsor" a sponsor prize. `event` is the search's event filter, so prizes from other
// events don't count while it's on.
export type PrizeFilter = "" | "win" | "1" | "2" | "3" | "sponsor";
export type ClassFilter = { key: string | null; prize: PrizeFilter; event: string | null };
export const NO_FILTER: ClassFilter = { key: null, prize: "", event: null };

export function prizeMatches(c: ProjectClass | undefined, prize: PrizeFilter, event: string | null) {
  const w = wins(c, event);
  if (prize === "") return true;
  if (prize === "win") return w.length > 0;
  if (prize === "sponsor") return w.some((p) => p.kind === "sponsor");
  return w.some((p) => p.kind === "placement" && p.place === Number(prize));
}

export function matches(data: ClassesFile | null, id: string, f: ClassFilter) {
  if (!data || (f.key === null && f.prize === "")) return true;
  const c = data.projects[id];
  if (f.key !== null && keyOf(c) !== f.key) return false;
  return prizeMatches(c, f.prize, f.event);
}

// Counts for the legend, from the stars actually on the map (so legend, map and list agree).
export function counts(data: ClassesFile, ids: string[], keep: (i: number) => boolean, event: string | null = null) {
  const byKey = new Map<string, number>();
  let prizes = 0;
  ids.forEach((id, i) => {
    if (!keep(i)) return;
    const c = data.projects[id];
    const key = keyOf(c);
    if (key !== null) byKey.set(key, (byKey.get(key) ?? 0) + 1);
    if (wins(c, event).length) prizes++;
  });
  return { byKey, prizes };
}

// One shared load and filter, read by the galaxy, legend, search and drawer.
// `focus`: whether an active idea dims the map to its neighbours. It turns off without deselecting the idea, which the
// other panels depend on, and comes back on for the next idea.
type Shared = { load: Load; filter: ClassFilter; focus: boolean };
let shared: Shared = { load: { state: "loading" }, filter: NO_FILTER, focus: true };
const listeners = new Set<() => void>();
const set = (patch: Partial<Shared>) => {
  shared = { ...shared, ...patch };
  listeners.forEach((l) => l());
};
export const setFocus = (focus: boolean) => set({ focus });
export const setClassFilter = (patch: Partial<ClassFilter>) => set({ filter: { ...shared.filter, ...patch } });
export function useClasses<T>(select: (s: Shared) => T): T {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => select(shared),
    () => select(shared),
  );
}

let started: string | null = null;
export function loadClasses(corpusVersion: string) {
  if (started === corpusVersion) return;
  started = corpusVersion;
  fetch("/api/classes")
    .then((r) => (r.status === 200 ? r.json() : Promise.reject(new Error("not found"))))
    .then((json) => set({ load: parseClasses(json, corpusVersion) }))
    .catch(() => set({ load: { state: "missing", reason: "categories not loaded" } }));
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

// A domain is labelled on the map only when it's compact: the median distance of its stars to their centroid is under
// 0.6 x the median distance of all stars to the corpus centre. A sprawling domain is named by the legend alone.
export function compactRegions(data: ClassesFile, ids: string[], positions: Float32Array, keep: (i: number) => boolean) {
  const at = (i: number) => [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]];
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const all = ids.map((_, i) => i).filter(keep);
  if (!all.length) return [];
  const mean = (is: number[]) => [0, 1, 2].map((k) => is.reduce((s, i) => s + positions[3 * i + k], 0) / is.length);
  const spread = median(all.map((i) => dist(at(i), mean(all))));
  return data.domains.flatMap((d) => {
    const is = all.filter((i) => keyOf(data.projects[ids[i]]) === d.id);
    if (is.length < 2) return [];
    const c = mean(is);
    return median(is.map((i) => dist(at(i), c))) < 0.6 * spread ? [{ key: d.id, label: d.label, count: is.length, at: c }] : [];
  });
}
