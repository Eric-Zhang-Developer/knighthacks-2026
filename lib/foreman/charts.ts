import { pace, type Board, type Feature, type PR } from "./board";
import { parseTitle, workerOf } from "./parse";
import { clock } from "./time";

// Series for the two charts (spec § Charts). Pure: snapshot in, points out, so the shapes are unit-tested.

/** Validated categorical palette (dataviz validate_palette.js, dark, surface #14110c: worst CVD ΔE 12.0). */
export const PR_GROUP = {
  feature: { label: "feature", color: "#41ae61" },
  fix: { label: "fix · refactor · test", color: "#a65d00" },
  rules: { label: "plan · contract", color: "#4b77cc" },
  other: { label: "other", color: "#4a4338" }, // neutral context, not a categorical hue
} as const;
export type PrGroup = keyof typeof PR_GROUP;

const group = (title: string): PrGroup => {
  const k = parseTitle(title)?.kind;
  return k === "feature" ? "feature" : k === "fix" ? "fix" : k === "plan" || k === "contract" ? "rules" : "other";
};

export type BuildUp = {
  start: number;
  end: number; // the freeze, or the snapshot if there's none or it has passed
  snapshot: number;
  steps: { t: number; built: number; slug: string | null }[]; // first point is the start
  target: { t: number; total: number; built: number | null } | null; // every live feature, due at the final freeze
  // The pace line from the snapshot: it ends where it reaches the target (eta) or at the freeze, whichever is first.
  projection: { t: number; built: number; eta: number } | null;
};

/**
 * Features built over time against the one real deadline: the final milestone's freeze (spec § Charts; interim
 * milestones get no marker). Only features in a milestone's live list count, so the line and the target measure
 * the same thing. Features done before the visible PR history count from the start.
 */
export function buildUp(board: Board, snapshot: number): BuildUp | null {
  if (!board.prsKnown || !board.stats.firstPrAt) return null;
  const live = new Set(board.milestones.flatMap((m) => m.features.filter((s) => !m.cut.includes(s))));
  const done = board.features.filter((f) => f.state === "done" && live.has(f.slug));
  const start = Date.parse(board.stats.firstPrAt);
  const base = done.filter((f) => !f.doneAt).length;
  const timed = done.filter((f) => f.doneAt).sort((a, b) => a.doneAt!.localeCompare(b.doneAt!));
  const steps = [{ t: start, built: base, slug: null as string | null }];
  timed.forEach((f, i) => steps.push({ t: Math.max(start, Date.parse(f.doneAt!)), built: base + i + 1, slug: f.slug }));
  const builtAt = (t: number) => steps.filter((s) => s.t <= t).at(-1)?.built ?? base;

  const final = board.milestones.at(-1);
  const deadline = final ? (final.freeze ?? final.ship) : null;
  const total = board.milestones.reduce((n, m) => n + m.total, 0);
  const target = deadline !== null && total > 0 ? { t: deadline, total, built: deadline <= snapshot ? builtAt(deadline) : null } : null;
  const now = builtAt(snapshot);
  const p = target && target.t > snapshot ? pace({ done: now, total }, board.features, snapshot) : null;
  return {
    start,
    end: Math.max(snapshot, target?.t ?? snapshot),
    snapshot,
    steps,
    target,
    projection:
      p && target
        ? { t: Math.min(p.eta, target.t), built: Math.min(total, now + p.perHour * ((target.t - snapshot) / 3_600_000)), eta: p.eta }
        : null,
  };
}

export type Bar = { lane: number; number: number; title: string; group: PrGroup; start: number; end: number; state: "merged" | "closed" | "open"; url: string };
export type Timeline = {
  start: number;
  snapshot: number;
  rows: { worker: string; lanes: number; bars: Bar[] }[]; // lanes: sub-rows, so overlapping PRs don't hide each other
  open: { t: number; n: number }[]; // PRs open at each change, every PR (named or not)
  peak: { t: number; n: number };
};

/** Every PR as a bar on its worker's row, plus how many PRs were open at once. */
export function timeline(prs: PR[], snapshot: number): Timeline | null {
  if (!prs.length) return null;
  const bar = (p: PR): Bar => ({
    lane: 0,
    number: p.number,
    title: p.title,
    group: group(p.title),
    start: Date.parse(p.createdAt),
    end: Math.min(snapshot, Date.parse(p.mergedAt ?? p.closedAt ?? new Date(snapshot).toISOString())),
    state: p.mergedAt ? "merged" : p.closedAt ? "closed" : "open",
    url: p.url,
  });
  const byWorker = new Map<string, Bar[]>();
  for (const p of prs) {
    const w = workerOf(p.body);
    if (w) byWorker.set(w, [...(byWorker.get(w) ?? []), bar(p)]);
  }
  const rows = [...byWorker]
    .map(([worker, bars]) => {
      // Greedy interval packing: each bar takes the first sub-row free by its start.
      const ends: number[] = [];
      for (const b of bars.sort((x, y) => x.start - y.start)) {
        b.lane = ends.findIndex((e) => e <= b.start);
        if (b.lane === -1) b.lane = ends.push(0) - 1;
        ends[b.lane] = b.end;
      }
      return { worker, lanes: ends.length, bars };
    })
    .sort((a, b) => a.bars[0].start - b.bars[0].start);

  // Sweep: +1 at each open, -1 at each close; ties close first, so a PR merged as the next opens isn't double-counted.
  const events = prs.flatMap((p) => {
    const b = bar(p);
    return b.state === "open" ? [{ t: b.start, d: 1 }] : [{ t: b.start, d: 1 }, { t: b.end, d: -1 }];
  });
  events.sort((a, b) => a.t - b.t || a.d - b.d);
  const open: Timeline["open"] = [];
  let n = 0;
  for (const e of events) {
    n += e.d;
    if (open.at(-1)?.t === e.t) open.at(-1)!.n = n;
    else open.push({ t: e.t, n });
  }
  const peak = open.reduce((a, b) => (b.n > a.n ? b : a), { t: 0, n: 0 });
  return { start: Math.min(...prs.map((p) => Date.parse(p.createdAt))), snapshot, rows, open, peak };
}

export type Chapter = { t: number; label: string };

/**
 * The replay's chapters (spec § The tour), from the snapshot alone, never written by hand: the first PR, each
 * milestone whose live features are all done (at the last one's merge), and the peak of PRs open at once.
 */
export function chapters(board: Board, crew: Timeline | null): Chapter[] {
  const out: Chapter[] = [];
  if (board.stats.firstPrAt) out.push({ t: Date.parse(board.stats.firstPrAt), label: "first PR" });
  for (const m of board.milestones) {
    const live = board.features.filter((f) => m.features.includes(f.slug) && !m.cut.includes(f.slug));
    if (!live.length || live.some((f) => f.state !== "done")) continue;
    const merged = live.flatMap((f) => (f.doneAt ? [Date.parse(f.doneAt)] : []));
    if (merged.length) out.push({ t: Math.max(...merged), label: `${m.name} built` });
  }
  if (crew && crew.peak.n > 1) out.push({ t: crew.peak.t, label: `${crew.peak.n} PRs open at once` });
  return out.sort((a, b) => a.t - b.t);
}

/** Named workers with a PR open at `t`. A still-open bar ends at the snapshot, so it counts there too. */
export function atWork(crew: Timeline, t: number): number {
  return crew.rows.filter((r) => r.bars.some((b) => b.start <= t && (t < b.end || b.state === "open"))).length;
}

// Story mode (spec § Story mode): the presenter's beats after the tour. Every number comes from the snapshot.
/**
 * The one feature the page follows: the done feature most others depend on directly (ties: the first in graph order),
 * with a merged feat PR so its card and the story thread can link the PR that built it. Story mode opens its card,
 * and the story section traces it through the loop, so both tell the same story.
 */
export function proofFeature(features: Feature[]): { slug: string; n: number } | null {
  const dependents = (slug: string) => features.filter((x) => x.deps.includes(slug)).length;
  return features
    .filter((f) => f.state === "done" && f.builtBy)
    .reduce<{ slug: string; n: number } | null>((best, f) => {
      const n = dependents(f.slug);
      return !best || n > best.n ? { slug: f.slug, n } : best;
    }, null);
}

export type Beat = { section: string; caption: string; open?: string };
export function beats(board: Board, crew: Timeline | null): Beat[] {
  if (!board.prsKnown || !crew) return [];
  const { stats, features } = board;
  const scheduled = features.filter((f) => f.milestone);
  const built = scheduled.filter((f) => f.state === "done").length;
  const since = stats.firstPrAt ? ` since ${clock(Date.parse(stats.firstPrAt))}` : "";
  const proof = proofFeature(features);
  const asks = board.asks.filter((a) => a.kind !== "review").length;
  const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
  return [
    {
      section: "how",
      caption: `The loop every agent runs, from AGENTS.md: ${n(stats.byKind.feature ?? 0, "feature PR")} merged through it${proof ? `, followed here for ${proof.slug}` : ""}. CI enforces the rules; plans wait for a person.`,
    },
    {
      section: "graph",
      caption: `${built}/${scheduled.length} features built, ${n(stats.merged, "PR")} merged, by ${n(stats.crew, "agent worker")}${since}. Space replays it.`,
    },
    ...(proof
      ? [
          {
            section: "graph",
            open: proof.slug,
            caption: `${proof.slug}: ${n(proof.n, "feature")} ${proof.n === 1 ? "depends" : "depend"} on it. Its spec, the PR that built it, and how it was checked.`,
          },
        ]
      : []),
    { section: "crew", caption: `One row per agent worker, every PR on it: up to ${crew.peak.n} PRs open at once.` },
    { section: "ask", caption: `${n(asks, "thing")} the agents can't clear themselves: this is where people come in.` },
  ];
}
