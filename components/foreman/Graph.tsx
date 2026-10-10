"use client";

import { useMemo, useState } from "react";
import { dur, layers, type Feature, type State } from "@/lib/foreman/board";
import styles from "./foreman.module.css";

const W = 158;
const H = 44;
const COL = 34; // gap between columns
const ROW = 12; // gap between rows
const PAD = 16;

export const STATE: Record<State, { label: string; fill: string; stroke: string; text: string; dash?: string }> = {
  done: { label: "built", fill: "#14301b", stroke: "#8fef9a", text: "#c9f7cf" },
  flight: { label: "under construction", fill: "#3a2a0e", stroke: "#ffb547", text: "#ffe3b3" },
  ready: { label: "ready to start", fill: "#14110c", stroke: "#f4ecdc", text: "#f4ecdc" },
  blocked: { label: "blocked", fill: "#14110c", stroke: "#4a4338", text: "#8a806e", dash: "4 3" },
  cut: { label: "cut", fill: "#14110c", stroke: "#e2674a", text: "#a0574a", dash: "2 4" },
  backlog: { label: "backlog", fill: "#0c0a07", stroke: "#2c261c", text: "#5a5244", dash: "1 3" },
};

/** The longest chain of unfinished features: the order work has to land in before the last one can start. */
function criticalPath(features: Feature[]): Set<string> {
  const by = new Map(features.map((f) => [f.slug, f]));
  const memo = new Map<string, [number, string | null]>();
  const len = (s: string, seen = new Set<string>()): [number, string | null] => {
    if (memo.has(s)) return memo.get(s)!;
    const f = by.get(s);
    if (!f || f.state === "done" || f.state === "cut" || f.state === "backlog" || seen.has(s)) return [0, null];
    seen.add(s);
    let best: [number, string | null] = [1, null];
    for (const d of f.deps) {
      const [n] = len(d, seen);
      if (n + 1 > best[0]) best = [n + 1, d];
    }
    memo.set(s, best);
    return best;
  };
  let end: string | null = null;
  for (const f of features) if (!end || len(f.slug)[0] > len(end)[0]) end = f.slug;
  const path = new Set<string>();
  for (let s = end; s && len(s)[0] > 0; s = len(s)[1]) path.add(s);
  return path.size > 1 ? path : new Set();
}

function layout(features: Feature[]) {
  const depth = layers(features);
  const cols: Feature[][] = [];
  for (const f of features) (cols[depth.get(f.slug)!] ??= []).push(f);
  const order = (f: Feature) => ["done", "flight", "ready", "blocked", "cut", "backlog"].indexOf(f.state);
  cols.forEach((c) => c.sort((a, b) => order(a) - order(b) || a.slug.localeCompare(b.slug)));
  // Barycenter sweeps: sort each column by the mean row of its dependencies, so edges cross less.
  const row = new Map<string, number>();
  const index = () => cols.forEach((c) => c.forEach((f, i) => row.set(f.slug, i - (c.length - 1) / 2)));
  index();
  for (let pass = 0; pass < 4; pass++) {
    for (const c of cols.slice(1)) {
      const bary = (f: Feature) => {
        const r = f.deps.filter((d) => row.has(d)).map((d) => row.get(d)!);
        return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0;
      };
      c.sort((a, b) => bary(a) - bary(b));
    }
    index();
  }
  const tallest = Math.max(...cols.map((c) => c.length));
  const height = PAD * 2 + tallest * H + (tallest - 1) * ROW;
  const pos = new Map<string, { x: number; y: number }>();
  cols.forEach((c, ci) =>
    c.forEach((f) => pos.set(f.slug, { x: PAD + ci * (W + COL), y: height / 2 + row.get(f.slug)! * (H + ROW) - H / 2 })),
  );
  return { pos, width: PAD * 2 + cols.length * W + (cols.length - 1) * COL, height };
}

// `shown` replays earlier states on the same layout; heat, CI and the critical path are live-only.
export default function Graph({
  features,
  repo,
  shown,
  heatBasis,
}: {
  features: Feature[];
  repo: string;
  shown?: Map<string, State>;
  heatBasis: "lines" | "activity";
}) {
  const { pos, width, height } = useMemo(() => layout(features), [features]);
  const live = useMemo(() => criticalPath(features), [features]);
  const critical = shown ? new Set<string>() : live;
  const stateOf = (f: Feature) => shown?.get(f.slug) ?? f.state;
  const [focus, setFocus] = useState<string | null>(null);

  // Hovering a feature lights up everything it waits on and everything waiting on it.
  const lit = useMemo(() => {
    if (!focus) return null;
    const by = new Map(features.map((f) => [f.slug, f]));
    const out = new Set([focus]);
    const up = (s: string) => by.get(s)?.deps.forEach((d) => !out.has(d) && (out.add(d), up(d)));
    const down = (s: string) => features.forEach((f) => f.deps.includes(s) && !out.has(f.slug) && (out.add(f.slug), down(f.slug)));
    up(focus);
    down(focus);
    return out;
  }, [focus, features]);

  const edges = features.flatMap((f) =>
    f.deps
      .filter((d) => pos.has(d))
      .map((d) => {
        const a = pos.get(d)!;
        const b = pos.get(f.slug)!;
        const [x1, y1, x2, y2] = [a.x + W, a.y + H / 2, b.x, b.y + H / 2];
        const mid = (x1 + x2) / 2;
        const done = shown ? shown.get(d) === "done" : features.find((x) => x.slug === d)?.state === "done";
        return {
          key: `${d}>${f.slug}`,
          path: `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`,
          stroke: critical.has(d) && critical.has(f.slug) ? "#ffb547" : done ? "#3f7a4a" : "#3a3328",
          critical: critical.has(d) && critical.has(f.slug),
          faded: lit !== null && !(lit.has(d) && lit.has(f.slug)),
        };
      }),
  );

  return (
    <>
      <div className={styles.graphWrap}>
        <svg className={styles.graph} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Feature dependency graph">
          <defs>
            <filter id="heat" x="-40%" y="-80%" width="180%" height="260%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>
          {edges.map((e) => (
            <path
              key={e.key}
              d={e.path}
              fill="none"
              stroke={e.stroke}
              strokeWidth={e.critical ? 2 : 1.2}
              strokeDasharray={e.critical ? "6 4" : undefined}
              className={e.faded ? styles.faded : undefined}
            />
          ))}
          {features.map((f) => {
            const p = pos.get(f.slug)!;
            const state = stateOf(f);
            const s = STATE[state];
            const sub = shown
              ? ""
              : f.missed
                ? `missed ${f.milestone}`
                : [f.pr ? `#${f.pr.number}` : null, f.buildMin !== null ? dur(f.buildMin) : null, f.worker]
                  .filter(Boolean)
                  .join(" · ");
            const href = f.pr?.url ?? `https://github.com/${repo}/tree/main/specs/features/${f.slug}`;
            return (
              <a
                key={f.slug}
                href={href}
                target="_blank"
                rel="noreferrer"
                className={`${styles.node} ${lit && !lit.has(f.slug) ? styles.faded : ""}`}
                onMouseEnter={() => setFocus(f.slug)}
                onMouseLeave={() => setFocus(null)}
                onFocus={() => setFocus(f.slug)}
                onBlur={() => setFocus(null)}
                data-slug={f.slug}
                data-state={state}
                aria-label={`${f.slug}: ${s.label}${sub ? `, ${sub}` : ""}`}
              >
                <title>{`${f.slug} — ${s.label}${f.missed ? ` · missed ${f.milestone}` : ""}\n${f.name}${f.buildMin !== null ? `\nBuilt in ${dur(f.buildMin)}, first PR to merge` : ""}${f.gap ? `\nGap: ${f.gap}` : ""}`}</title>
                {!shown && f.heat > 0.05 && (
                  <rect x={p.x - 4} y={p.y - 4} width={W + 8} height={H + 8} rx={6} fill="#ff8a1f" opacity={0.25 + f.heat * 0.6} filter="url(#heat)" />
                )}
                <rect
                  className={`box ${state === "flight" ? styles.pulse : ""}`}
                  x={p.x}
                  y={p.y}
                  width={W}
                  height={H}
                  rx={2}
                  fill={s.fill}
                  stroke={critical.has(f.slug) && state !== "flight" ? "#ffb547" : s.stroke}
                  strokeWidth={state === "flight" || critical.has(f.slug) ? 1.6 : 1}
                  strokeDasharray={s.dash}
                />
                <text x={p.x + 8} y={p.y + 19} fill={s.text} fontSize={13.5} fontWeight={500}>
                  {f.slug.length > 19 ? `${f.slug.slice(0, 18)}…` : f.slug}
                </text>
                <text x={p.x + 8} y={p.y + 35} fill={!shown && f.missed ? "#e2674a" : s.text} opacity={!shown && f.missed ? 1 : 0.7} fontSize={11}>
                  {(sub || s.label).length > 22 ? `${(sub || s.label).slice(0, 21)}…` : sub || s.label}
                </text>
                {!shown && f.state === "done" && f.verified === false && <circle cx={p.x + W - 9} cy={p.y + 9} r={3} fill="#f5c518" />}
                {!shown && f.state === "flight" && f.pr && (
                  <circle
                    cx={p.x + W - 9}
                    cy={p.y + 9}
                    r={3}
                    fill={f.pr.ci === "success" ? "#8fef9a" : f.pr.ci === "failure" ? "#e2674a" : "#ffb547"}
                  />
                )}
              </a>
            );
          })}
        </svg>
      </div>
      <div className={styles.legend}>
        {(Object.keys(STATE) as State[]).map((k) => (
          <span key={k}>
            <i style={{ background: STATE[k].fill, border: `1px solid ${STATE[k].stroke}` }} />
            {STATE[k].label} ({features.filter((f) => stateOf(f) === k).length})
          </span>
        ))}
        <span>
          <i style={{ background: "#ff8a1f", filter: "blur(2px)" }} />
          heat = {heatBasis === "lines" ? "lines changed" : "PR activity"}, last 3h
        </span>
        <span>
          <i style={{ background: "transparent", borderTop: "2px dashed #ffb547", height: 0 }} />
          critical path
        </span>
        <span>
          <i style={{ background: "#f5c518", borderRadius: "50%" }} />
          done, not verified
        </span>
      </div>
    </>
  );
}
