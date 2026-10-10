"use client";

import { useState } from "react";
import type { BuildUp as Data } from "@/lib/foreman/charts";
import { clock } from "@/lib/foreman/time";
import styles from "./foreman.module.css";

const W = 1200;
const H = 230;
const L = 44; // y labels
const R = 16;
const T = 18;
const B = 26; // x labels
const LINE = "#8fef9a"; // the page's "built" green: one series, so no categorical hue

const hour = 3_600_000;

// Features built over time against the final freeze (spec § Charts). Hover for the count at any moment.
export default function BuildUp({ data }: { data: Data }) {
  const [hover, setHover] = useState<number | null>(null);
  const { start, end, snapshot, steps, target, projection } = data;
  const top = Math.max(1, target?.total ?? 0, ...steps.map((s) => s.built));
  const x = (t: number) => L + ((t - start) / Math.max(1, end - start)) * (W - L - R);
  const y = (n: number) => T + (1 - n / top) * (H - T - B);
  const at = (t: number) => steps.filter((s) => s.t <= t).at(-1)!;

  // Step path: horizontal to each merge, then up. Ends at the snapshot.
  const d = steps.map((s, i) => (i === 0 ? `M${x(s.t)},${y(s.built)}` : `H${x(s.t)}V${y(s.built)}`)).join("") + `H${x(snapshot)}`;
  const area = `${d}V${y(0)}H${x(start)}Z`;
  const ticks: number[] = [];
  const every = Math.max(1, Math.ceil((end - start) / hour / 10)) * hour; // at most ~10 labels
  for (let t = Math.ceil(start / every) * every; t <= end; t += every) ticks.push(t);
  const yTicks = [0, Math.round(top / 2), top];
  const h = hover !== null ? at(hover) : null;

  return (
    <figure className={styles.chart} aria-label="Features built over time against each milestone's target">
      <div className={styles.chartWrap}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={styles.chartSvg}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const t = start + (((e.clientX - r.left) / r.width) * W - L) / (W - L - R) * (end - start);
            setHover(t >= start && t <= snapshot ? t : null);
          }}
          onMouseLeave={() => setHover(null)}
        >
          {yTicks.map((n) => (
            <g key={n}>
              <line x1={L} x2={W - R} y1={y(n)} y2={y(n)} stroke="#2c261c" strokeWidth={1} />
              <text x={L - 8} y={y(n) + 4} textAnchor="end" className={styles.axis}>
                {n}
              </text>
            </g>
          ))}
          {ticks.map((t) => (
            <text key={t} x={x(t)} y={H - 8} textAnchor="middle" className={styles.axis}>
              {clock(t).replace(/:\d\d$/, "h")}
            </text>
          ))}
          <path d={area} fill={LINE} opacity={0.07} />
          <path d={d} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" />
          {projection && (
            <line
              x1={x(snapshot)}
              y1={y(at(snapshot).built)}
              x2={x(projection.t)}
              y2={y(projection.built)}
              stroke={LINE}
              strokeWidth={2}
              strokeDasharray="5 5"
              opacity={0.6}
            />
          )}
          <line x1={x(snapshot)} x2={x(snapshot)} y1={T - 6} y2={y(0)} stroke="#ffb547" strokeWidth={1} strokeDasharray="3 3" />
          <text x={x(snapshot) - 4} y={T - 8} textAnchor="end" className={styles.axis}>
            snapshot
          </text>
          {target && (
            <g>
              <line x1={x(target.t)} x2={x(target.t)} y1={T} y2={y(0)} stroke="#e9dfcc" strokeWidth={1} strokeDasharray="2 4" opacity={0.6} />
              <line x1={L} x2={x(target.t)} y1={y(target.total)} y2={y(target.total)} stroke="#e9dfcc" strokeWidth={1} strokeDasharray="2 4" opacity={0.35} />
              <circle cx={x(target.t)} cy={y(target.total)} r={5} fill="#14110c" stroke={target.built !== null && target.built >= target.total ? LINE : "#e9dfcc"} strokeWidth={2} />
              <text x={x(target.t) - 10} y={y(target.total) - 10} textAnchor="end" className={styles.chartLabel}>
                freeze {clock(target.t)} · {target.total} features
                {target.built !== null && ` (${target.built} built)`}
              </text>
            </g>
          )}
          {h && hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={T} y2={y(0)} stroke="#e9dfcc" strokeWidth={1} opacity={0.5} />
              <circle cx={x(hover)} cy={y(h.built)} r={4} fill={LINE} stroke="#14110c" strokeWidth={2} />
            </g>
          )}
        </svg>
        {h && hover !== null && (
          <div className={styles.tip} style={{ left: `${(x(hover) / W) * 100}%` }} role="status" data-testid="buildup-tip">
            <b>{clock(hover)}</b> · {h.built} built
            {h.slug && <span> · last: {h.slug}</span>}
          </div>
        )}
      </div>
      <figcaption className={styles.legend}>
        <span>
          <i style={{ background: LINE }} /> features built
        </span>
        {projection && (
          <span>
            <i className={styles.dash} style={{ borderColor: LINE }} /> at the last 3h&apos;s pace:{" "}
            {target && projection.eta <= target.t
              ? `all ${target.total} by ~${clock(projection.eta)}`
              : `~${Math.floor(projection.built)} of ${target?.total} by the freeze`}
          </span>
        )}
        <span>
          <i className={styles.ring} /> every planned feature, due at the freeze
        </span>
      </figcaption>
      <details className={styles.tableView}>
        <summary>table</summary>
        <table>
          <thead>
            <tr>
              <th>time</th>
              <th>built</th>
              <th>feature</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => (
              <tr key={s.t + (s.slug ?? "")}>
                <td>{clock(s.t)}</td>
                <td>{s.built}</td>
                <td>{s.slug ?? "before the first PR"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
