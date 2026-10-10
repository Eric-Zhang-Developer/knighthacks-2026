import {
  asList,
  firstGap,
  firstLine,
  frontMatter,
  isVerified,
  parseMilestonesToml,
  parseSpan,
  parseTitle,
  parseWhen,
  workerNoteOf,
  workerOf,
} from "./parse";

// Everything the board is built from: the snapshot lib/foreman/collect.ts takes once per build. Pure data, so
// tests can build a board offline.
export type PR = {
  number: number;
  title: string;
  draft: boolean;
  state: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  url: string;
  body: string | null;
  headSha: string;
  ci?: Ci;
};
export type Issue = { number: number; title: string; url: string; labels: string[]; createdAt: string };
export type Ci = "success" | "failure" | "pending" | "none" | "unknown";
// The API pass: whether it had a token, what it spent, what GitHub says is left, and why it stopped.
export type Api = { token: boolean; calls: number; remaining: number | null; limit: number | null; error: string | null };
export type Raw = {
  repo: string;
  sha: string; // the commit being built
  fetchedAt: string; // the snapshot time
  files: Record<string, string>; // path -> text, for specs/**, changes/*.md, specs/milestones.toml
  stop: boolean; // a STOP file in the checkout
  prs: PR[]; // newest first, open and closed
  issues: Issue[]; // open issues only
  prsKnown: boolean; // false without a token or when the API failed: prs and issues are empty, not "none"
  mainCi: Ci; // the latest completed push run on main
  mainCiUrl: string | null;
  api: Api;
};

export type State = "done" | "flight" | "ready" | "blocked" | "cut" | "backlog" | "unknown";
export const STATE_TEXT: Record<State, string> = {
  done: "built",
  flight: "under construction",
  ready: "ready to start",
  blocked: "blocked",
  cut: "on cut list",
  backlog: "backlog",
  unknown: "unknown: needs PR data",
};
export type Feature = {
  slug: string;
  name: string;
  deps: string[];
  milestone: string | null;
  state: State;
  worker: string | null;
  pr: { number: number; url: string; draft: boolean; ci: Ci } | null;
  verified: boolean | null; // null until done
  gap: string;
  shipped: string; // first line of the done note
  fixes: number;
  heat: number; // 0..1, PR activity on this feature in the HEAT_HOURS before the snapshot
  doneAt: string | null; // when its feat PR merged (null if done some other way)
  startedAt: string | null; // when its first feat PR opened
  claims: [string, string | null][]; // each feat PR as [opened, merged or closed]: when someone was building it
  buildMin: number | null; // first feat PR opened -> the merge that finished it
  missed: boolean; // its milestone shipped without it
  specDir: string; // specs/features/<slug> while in flight, specs/shipped/<milestone>/<slug> after ship.py
};
export type Milestone = {
  name: string;
  ship: number | null;
  freeze: number | null;
  report: number | null;
  final: boolean;
  features: string[];
  cut: string[];
  done: number;
  total: number;
};
export type Ask = { kind: "merge" | "clash" | "pickable" | "issue" | "stale" | "ci" | "stop" | "review"; title: string; detail: string; url: string | null };
export type Lane = { worker: string; note: string | null; prs: (PR & { scope: string | null; kind: string | null })[]; merged: number };
export type Board = {
  api: Api;
  prsKnown: boolean;
  repo: string;
  sha: string;
  fetchedAt: string;
  start: number | null;
  milestones: Milestone[];
  features: Feature[];
  asks: Ask[];
  lanes: Lane[];
  stats: {
    merged: number;
    byKind: Record<string, number>;
    medianOpenMin: number | null;
    workers: number;
    reverts: number;
    crew: number; // named workers with at least one merged PR
    firstPrAt: string | null;
  };
  replay: { at: string; number: number; title: string; slug: string | null; kind: string | null }[];
};

export const HEAT_HOURS = 3;
export const STALE_MIN = 45; // .agents/config.toml [watchdog] stale_claim_minutes

export const dur = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`);
const minutes = (a: number, b: number) => Math.round((a - b) / 60_000);

export function buildBoard(raw: Raw, now: number): Board {
  const ms = parseMilestonesToml(raw.files["specs/milestones.toml"] ?? "");
  const start = ms.start ? parseWhen(ms.start, null) : null;
  const milestones = ms.milestone.map((m) => {
    const ship = parseWhen(m.ship, start);
    const freeze = parseSpan(m.freeze);
    const report = parseSpan(m.report_before);
    return {
      name: String(m.name ?? ""),
      ship,
      freeze: ship && freeze ? ship - freeze : null,
      report: ship && m.final && report ? ship - report : null,
      final: Boolean(m.final),
      features: asList(m.features),
      cut: asList(m.cut),
      done: 0,
      total: 0,
    };
  });

  // Specs live in specs/features/<slug>/ while in flight, and specs/shipped/<milestone>/<slug>/ once shipped.
  const specs = new Map<string, Record<string, unknown>>();
  const specPath = new Map<string, string>();
  for (const [path, text] of Object.entries(raw.files)) {
    const m = /^specs\/(?:features|shipped\/[^/]+)\/([^/_][^/]*)\/spec\.md$/.exec(path);
    if (m) {
      specs.set(m[1], frontMatter(text));
      specPath.set(m[1], path.replace(/\/spec\.md$/, ""));
    }
  }
  const notes = new Map<string, string>();
  for (const [path, text] of Object.entries(raw.files)) {
    const m = /^changes\/([^/]+)\.md$/.exec(path);
    if (m) notes.set(m[1], text);
  }

  const titled = raw.prs.map((p) => ({ ...p, t: parseTitle(p.title) }));
  const openFeat = new Map<string, (typeof titled)[number]>();
  for (const p of titled) if (p.state === "open" && p.t?.kind === "feature" && p.t.scope) openFeat.set(p.t.scope, p);

  const fixes = new Map<string, number>();
  for (const p of titled) {
    if (!p.mergedAt) continue;
    const inner = p.title.startsWith('Revert "') ? p.title.slice(8).replace(/"$/, "") : p.title;
    const t = parseTitle(inner);
    if (t?.scope && (inner !== p.title || t.kind === "fix" || t.kind === "revert"))
      fixes.set(t.scope, (fixes.get(t.scope) ?? 0) + 1);
  }

  // Heat: PRs on a feature touched in the window, each weighted toward the most recent.
  const heatRaw = new Map<string, number>();
  for (const p of titled) {
    const age = now - Date.parse(p.updatedAt);
    if (p.t?.scope && age >= 0 && age <= HEAT_HOURS * 3_600_000)
      heatRaw.set(p.t.scope, (heatRaw.get(p.t.scope) ?? 0) + 1 - age / (HEAT_HOURS * 3_600_000));
  }
  const maxHeat = Math.max(1e-9, ...heatRaw.values());

  const scheduled = new Map<string, string>();
  for (const m of milestones) for (const s of m.features) if (!scheduled.has(s)) scheduled.set(s, m.name);
  // `allow` features (like this page) may merge in that milestone without being in its pick order.
  for (const m of ms.milestone) for (const s of asList(m.allow)) if (!scheduled.has(s)) scheduled.set(s, String(m.name));
  const cut = new Set(milestones.flatMap((m) => m.cut));

  const features: Feature[] = [...specs.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, fm]) => {
      const deps = asList(fm.depends_on);
      const note = notes.get(slug);
      const open = openFeat.get(slug);
      const feats = titled.filter((p) => p.t?.kind === "feature" && p.t.scope === slug);
      const merged = feats.filter((p) => p.mergedAt).map((p) => p.mergedAt!).sort();
      const opened = feats.map((p) => p.createdAt).sort();
      // An open PR wins over the cut list: cut means "drop first if late" (milestones.toml), not "don't build".
      // Without PR data, in flight can't be told from ready or blocked, so those are unknown rather than a guess.
      const state: State = note
        ? "done"
        : open
          ? "flight"
          : cut.has(slug)
            ? "cut"
            : !scheduled.has(slug)
              ? "backlog"
              : !raw.prsKnown
                ? "unknown"
                : deps.every((d) => notes.has(d))
                  ? "ready"
                  : "blocked";
      return {
        slug,
        name: String(fm.name ?? ""),
        deps,
        milestone: scheduled.get(slug) ?? null,
        state,
        worker: open ? workerOf(open.body) : (feats.map((p) => workerOf(p.body)).find(Boolean) ?? (fm.assignee ? String(fm.assignee) : null)),
        pr: open ? { number: open.number, url: open.url, draft: open.draft, ci: open.ci ?? "none" } : null,
        verified: note ? isVerified(note) : null,
        gap: note ? firstGap(note) : "",
        shipped: note ? firstLine(note) : "",
        fixes: fixes.get(slug) ?? 0,
        heat: (heatRaw.get(slug) ?? 0) / maxHeat,
        doneAt: note ? (merged.at(-1) ?? null) : null,
        startedAt: opened[0] ?? null,
        claims: feats.map((p): [string, string | null] => [p.createdAt, p.mergedAt ?? p.closedAt]),
        buildMin: note && merged.length && opened.length ? minutes(Date.parse(merged.at(-1)!), Date.parse(opened[0])) : null,
        specDir: specPath.get(slug)!,
        missed: !note && milestones.some((m) => m.ship !== null && m.ship <= now && m.features.includes(slug) && !m.cut.includes(slug)),
      };
    });

  for (const m of milestones) {
    const live = m.features.filter((s) => specs.has(s) && !m.cut.includes(s));
    m.total = live.length;
    m.done = live.filter((s) => notes.has(s)).length;
  }

  const asks: Ask[] = [];
  if (raw.stop)
    asks.push({ kind: "stop", title: "STOP file is on main", detail: "Every agent stops until it's removed", url: null });
  if (raw.mainCi === "failure")
    asks.push({ kind: "ci", title: "main is red", detail: "The latest finished run on main failed; only the fix merges until it's green", url: raw.mainCiUrl });
  // Two open feat PRs on one feature: the earlier draft is the claim (AGENTS.md), so the later one is wasted work.
  const claims = new Map<string, typeof titled>();
  for (const p of titled)
    if (p.state === "open" && p.t?.kind === "feature" && p.t.scope) claims.set(p.t.scope, [...(claims.get(p.t.scope) ?? []), p]);
  for (const [slug, ps] of claims) {
    if (ps.length < 2) continue;
    const [first, ...rest] = [...ps].sort((a, b) => a.number - b.number);
    const who = (p: (typeof ps)[number]) => `#${p.number} (${workerOf(p.body) ?? "unnamed"})`;
    asks.push({
      kind: "clash",
      title: `${ps.length} agents are building ${slug}`,
      detail: `${who(first)} claimed it first; ${rest.map(who).join(", ")} duplicate it`,
      url: rest[0].url,
    });
  }
  for (const p of titled) {
    if (p.state !== "open") continue;
    if (!p.draft && (p.t?.kind === "plan" || p.t?.kind === "contract"))
      asks.push({ kind: "merge", title: p.title, detail: `#${p.number} waits for a person to merge`, url: p.url });
    else if (p.draft && minutes(now, Date.parse(p.updatedAt)) >= STALE_MIN)
      asks.push({ kind: "stale", title: p.title, detail: `#${p.number}: no push for ${minutes(now, Date.parse(p.updatedAt))} min at snapshot; the session may be dead`, url: p.url });
  }
  for (const i of raw.issues) {
    const flags = i.labels.filter((l) => ["needs-human", "blocked", "one-way-door", "contract-change"].includes(l));
    if (flags.length) asks.push({ kind: "issue", title: i.title, detail: `#${i.number} · ${flags.join(" · ")}`, url: i.url });
  }
  // Cut means "drop first if late", but a cut feature left in its milestone's features is still in pick order: the
  // next agent can start it. Only a person (a plan: PR) can take it out, so it's an ask, until the freeze rejects it.
  for (const f of features) {
    const m = milestones.find((x) => x.cut.includes(f.slug) && x.features.includes(f.slug));
    const open = m && (m.ship === null || m.ship > now) && (m.freeze === null || m.freeze > now);
    // Without PR data someone may already be building it, so don't claim it's free to pick.
    if (raw.prsKnown && f.state === "cut" && open && f.deps.every((d) => notes.has(d)))
      asks.push({
        kind: "pickable",
        title: `${f.slug} is cut but still pickable`,
        detail: `on ${m!.name}'s cut list and in its features, dependencies done: the next agent may start it. A plan: PR can drop it`,
        url: `https://github.com/${raw.repo}/blob/main/specs/milestones.toml`,
      });
  }
  for (const f of features)
    if (f.state === "done" && (!f.verified || f.gap))
      asks.push({
        kind: "review",
        title: f.slug,
        detail: [f.verified ? "" : "not verified", f.gap].filter(Boolean).join(" · "),
        url: `https://github.com/${raw.repo}/blob/main/changes/${f.slug}.md`,
      });

  const laneMap = new Map<string, Lane>();
  const lane = (w: string) => laneMap.get(w) ?? laneMap.set(w, { worker: w, note: null, prs: [], merged: 0 }).get(w)!;
  for (const p of titled) {
    const w = workerOf(p.body) ?? "unnamed";
    lane(w).note ??= workerNoteOf(p.body); // newest PR first, so the latest self-description wins
    if (p.state === "open") lane(w).prs.push({ ...p, scope: p.t?.scope ?? null, kind: p.t?.kind ?? null });
    else if (p.mergedAt) lane(w).merged++;
  }
  const lanes = [...laneMap.values()].filter((l) => l.prs.length).sort((a, b) => b.prs.length - a.prs.length || b.merged - a.merged);

  const merged = titled.filter((p) => p.mergedAt);
  const byKind: Record<string, number> = {};
  for (const p of merged) byKind[p.t?.kind ?? "other"] = (byKind[p.t?.kind ?? "other"] ?? 0) + 1;
  const open = merged.map((p) => minutes(Date.parse(p.mergedAt!), Date.parse(p.createdAt))).sort((a, b) => a - b);
  const recent = new Set(titled.filter((p) => now - Date.parse(p.updatedAt) < HEAT_HOURS * 3_600_000).map((p) => workerOf(p.body)).filter(Boolean));

  return {
    api: raw.api,
    prsKnown: raw.prsKnown,
    repo: raw.repo,
    sha: raw.sha,
    fetchedAt: raw.fetchedAt,
    start,
    milestones,
    features,
    asks,
    lanes,
    stats: {
      merged: merged.length,
      byKind,
      medianOpenMin: open.length ? open[Math.floor(open.length / 2)] : null,
      workers: recent.size,
      crew: new Set(merged.map((p) => workerOf(p.body)).filter(Boolean)).size,
      firstPrAt: titled.map((p) => p.createdAt).sort()[0] ?? null,
      reverts: byKind.revert ?? 0,
    },
    replay: merged
      .map((p) => ({ at: p.mergedAt!, number: p.number, title: p.title, slug: p.t?.scope ?? null, kind: p.t?.kind ?? null }))
      .sort((a, b) => a.at.localeCompare(b.at)),
  };
}

export const PACE_HOURS = 3;

/**
 * When a milestone's remaining features would land at the recent build rate: features finished in the last
 * PACE_HOURS, per hour. null when nothing is left, or nothing was built in the window (no pace to project).
 */
// ponytail: straight-line rate, ignores dependency order and parallelism; good enough to say "on time / late"
export function pace(m: Pick<Milestone, "done" | "total">, features: Pick<Feature, "doneAt">[], now: number) {
  const left = m.total - m.done;
  const recent = features.filter((f) => f.doneAt && now - Date.parse(f.doneAt) <= PACE_HOURS * 3_600_000).length;
  if (left <= 0 || recent === 0) return null;
  const perHour = recent / PACE_HOURS;
  return { left, perHour, eta: now + (left / perHour) * 3_600_000 };
}

/**
 * Each feature's state at an earlier time, from PR history: done once its feat PR merged, in flight while a feat PR
 * was open. Cut and backlog are today's plan, not history. A done feature with no merged feat PR counts as done from
 * the start, since it predates the PR history we can see.
 */
export function statesAt(features: Feature[], t: number): Map<string, State> {
  const done = new Set(features.filter((f) => f.state === "done" && (!f.doneAt || Date.parse(f.doneAt) <= t)).map((f) => f.slug));
  return new Map(
    features.map((f): [string, State] => {
      if (done.has(f.slug)) return [f.slug, "done"];
      if (f.claims.some(([a, b]) => Date.parse(a) <= t && (!b || Date.parse(b) > t))) return [f.slug, "flight"];
      if (f.state === "cut" || f.state === "backlog" || f.state === "unknown") return [f.slug, f.state];
      return [f.slug, f.deps.every((d) => done.has(d)) ? "ready" : "blocked"];
    }),
  );
}

/** Longest-path layering: a feature sits one column right of its deepest dependency. */
export function layers(features: Pick<Feature, "slug" | "deps">[]): Map<string, number> {
  const bySlug = new Map(features.map((f) => [f.slug, f]));
  const depth = new Map<string, number>();
  const visit = (s: string, seen: Set<string>): number => {
    if (depth.has(s)) return depth.get(s)!;
    if (seen.has(s)) return 0; // a cycle: break it rather than hang
    seen.add(s);
    const deps = (bySlug.get(s)?.deps ?? []).filter((d) => bySlug.has(d));
    const d = deps.length ? 1 + Math.max(...deps.map((x) => visit(x, seen))) : 0;
    depth.set(s, d);
    return d;
  };
  for (const f of features) visit(f.slug, new Set());
  return depth;
}
