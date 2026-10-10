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

export type ClassFilter = { key: string | null; prizes: boolean };
export const NO_FILTER: ClassFilter = { key: null, prizes: false };

export function matches(data: ClassesFile | null, id: string, f: ClassFilter, event?: string | null) {
  if (!data || (f.key === null && !f.prizes)) return true;
  const c = data.projects[id];
  if (f.key !== null && keyOf(c) !== f.key) return false;
  return !f.prizes || wins(c, event).length > 0;
}

// Counts for the legend, from the stars actually on the map (so legend, map and list agree).
export function counts(data: ClassesFile, ids: string[], keep: (i: number) => boolean) {
  const byKey = new Map<string, number>();
  let prizes = 0;
  ids.forEach((id, i) => {
    if (!keep(i)) return;
    const c = data.projects[id];
    const key = keyOf(c);
    if (key !== null) byKey.set(key, (byKey.get(key) ?? 0) + 1);
    if (wins(c).length) prizes++;
  });
  return { byKey, prizes };
}

// One shared load and filter, read by the galaxy, legend, search and drawer.
type Shared = { load: Load; filter: ClassFilter };
let shared: Shared = { load: { state: "loading" }, filter: NO_FILTER };
const listeners = new Set<() => void>();
const set = (patch: Partial<Shared>) => {
  shared = { ...shared, ...patch };
  listeners.forEach((l) => l());
};
export const setClassFilter = (filter: ClassFilter) => set({ filter });
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
  fetch("/classify/classes.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not found"))))
    .then((json) => set({ load: parseClasses(json, corpusVersion) }))
    .catch(() => set({ load: { state: "missing", reason: "categories not loaded" } }));
}
