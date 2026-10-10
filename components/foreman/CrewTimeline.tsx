"use client";

import { useState } from "react";
import { PR_GROUP, type Bar, type Timeline } from "@/lib/foreman/charts";
import { dur } from "@/lib/foreman/board";
import { clock } from "@/lib/foreman/time";
import styles from "./foreman.module.css";

const W = 1200;
const NAME = 180; // worker names
const R = 16;
const STRIP = 44; // PRs open at once
const LANE = 15; // one sub-row
const BAR = 10;
const GAP = 7; // between workers
const hour = 3_600_000;

// Every PR on its worker's row, opened to merged (spec § Charts), above a strip of how many were open at once.
export default function CrewTimeline({ data }: { data: Timeline }) {
  const [hover, setHover] = useState<{ bar: Bar; worker: string; y: number } | null>(null);
  const { start, snapshot, rows, open, peak } = data;
  const x = (t: number) => NAME + ((t - start) / Math.max(1, snapshot - start)) * (W - NAME - R);
  const top = STRIP + 14;
  // Each worker's band: its sub-rows plus a gap. ys[i] = the band's top.
  const ys = rows.reduce<number[]>((acc, r, i) => [...acc, i === 0 ? top : acc[i - 1] + rows[i - 1].lanes * LANE + GAP], []);
  const H = (rows.length ? ys.at(-1)! + rows.at(-1)!.lanes * LANE : top) + 22;
  const sy = (n: number) => STRIP - (n / Math.max(1, peak.n)) * (STRIP - 6);
  const strip = open.map((o, i) => `${i === 0 ? "M" : "H"}${x(o.t)}${i === 0 ? `,${sy(0)}V${sy(o.n)}` : `V${sy(o.n)}`}`).join("") + `H${x(snapshot)}`;
  const ticks: number[] = [];
  const every = Math.max(1, Math.ceil((snapshot - start) / hour / 10)) * hour;
  for (let t = Math.ceil(start / every) * every; t <= snapshot; t += every) ticks.push(t);
  const label = (b: Bar) => (b.state === "open" ? "open" : `${b.state} ${clock(b.end).split(" ")[1]}`);

  return (
    <figure className={styles.chart} aria-label="Every PR by worker over time">
      <div className={styles.chartWrap}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.chartSvg} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={top - 6} y2={H - 20} stroke="#2c261c" strokeWidth={1} />
              <text x={x(t)} y={H - 6} textAnchor="middle" className={styles.axis}>
                {clock(t).replace(/:\d\d$/, "h")}
              </text>
            </g>
          ))}
          <text x={0} y={STRIP - 4} className={styles.axis}>
            PRs open
          </text>
          <path d={`${strip}V${sy(0)}Z`} fill="#ffb547" opacity={0.18} />
          <path d={strip} fill="none" stroke="#ffb547" strokeWidth={1.5} />
          <circle cx={x(peak.t)} cy={sy(peak.n)} r={4} fill="#ffb547" stroke="#14110c" strokeWidth={2} />
          <text
            x={x(peak.t) + (x(peak.t) > W * 0.75 ? -8 : 8)}
            y={sy(peak.n) + 4}
            textAnchor={x(peak.t) > W * 0.75 ? "end" : "start"}
            className={styles.chartLabel}
          >
            {peak.n} at once · {clock(peak.t).split(" ")[1]}
          </text>
          {rows.map((r, i) => {
            const y = ys[i];
            return (
              <g key={r.worker}>
                {i > 0 && <line x1={0} x2={W - R} y1={y - GAP / 2} y2={y - GAP / 2} stroke="#2c261c" strokeWidth={1} opacity={0.6} />}
                <text x={0} y={y + LANE / 2 + 4} className={styles.chartLabel}>
                  {r.worker.length > 22 ? `${r.worker.slice(0, 21)}…` : r.worker}
                </text>
                {r.bars.map((b) => {
                  const x1 = x(b.start);
                  const w = Math.max(4, x(b.end) - x1);
                  const c = PR_GROUP[b.group].color;
                  const by = y + b.lane * LANE;
                  return (
                    <a key={b.number} href={b.url} target="_blank" rel="noreferrer" aria-label={`#${b.number} ${b.title}`}>
                      {/* Hit target taller than the bar; the bar itself is drawn below it. */}
                      <rect x={x1} y={by} width={w} height={LANE} fill="transparent" onMouseEnter={() => setHover({ bar: b, worker: r.worker, y: by })} />
                      <rect
                        x={x1}
                        y={by + (LANE - BAR) / 2}
                        width={w}
                        height={BAR}
                        rx={2}
                        fill={b.state === "merged" ? c : "none"}
                        stroke={b.state === "merged" ? "#14110c" : c}
                        strokeWidth={b.state === "merged" ? 1 : 1.5}
                        strokeDasharray={b.state === "closed" ? "3 2" : undefined}
                        className={b.state === "open" ? styles.pulse : undefined}
                        opacity={hover && hover.bar.number !== b.number ? 0.55 : 1}
                        pointerEvents="none"
                      />
                    </a>
                  );
                })}
              </g>
            );
          })}
          <line x1={x(snapshot)} x2={x(snapshot)} y1={0} y2={H - 20} stroke="#ffb547" strokeWidth={1} strokeDasharray="3 3" />
        </svg>
        {hover && (
          <div
            className={styles.tip}
            style={{ left: `${(x(hover.bar.start) / W) * 100}%`, top: `${((hover.y + LANE + 4) / H) * 100}%` }}
            role="status"
            data-testid="timeline-tip"
          >
            <b>#{hover.bar.number}</b> {hover.bar.title}
            <span>
              {hover.worker} · opened {clock(hover.bar.start).split(" ")[1]} · {label(hover.bar)} ·{" "}
              {dur(Math.round((hover.bar.end - hover.bar.start) / 60_000))}
            </span>
          </div>
        )}
      </div>
      <figcaption className={styles.legend}>
        {Object.values(PR_GROUP).map((g) => (
          <span key={g.label}>
            <i style={{ background: g.color }} /> {g.label}
          </span>
        ))}
        <span>
          <i className={styles.hollow} /> open (to the snapshot)
        </span>
        <span>
          <i className={styles.hollow} style={{ borderStyle: "dashed" }} /> closed unmerged
        </span>
      </figcaption>
      <details className={styles.tableView}>
        <summary>table</summary>
        <table>
          <thead>
            <tr>
              <th>worker</th>
              <th>PR</th>
              <th>type</th>
              <th>opened</th>
              <th>ended</th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((r) =>
              r.bars.map((b) => (
                <tr key={b.number}>
                  <td>{r.worker}</td>
                  <td>
                    #{b.number} {b.title}
                  </td>
                  <td>{PR_GROUP[b.group].label}</td>
                  <td>{clock(b.start)}</td>
                  <td>{b.state === "open" ? "open" : `${b.state} ${clock(b.end)}`}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
