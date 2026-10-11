"use client";

import { memo } from "react";
import type { Status } from "./director";
import styles from "./scan.module.css";

// The scan readout (specs/features/idea-scan, Plan 3): the scan as it happens, over the galaxy's lower left. Every
// number is read from data: similarity from /api/scan, counts from stars.json and classes.json. Similarity that
// didn't load says so instead of showing a number.
export type ScanRow = { id: string; title: string; similarity: number | null };
export type Survey = { clouds: { slot: number; n: number; label: string; colour: readonly number[] }[]; prizes: number };

const fmt = (n: number) => n.toLocaleString("en-US");
const rgb = (c: readonly number[]) => `rgb(${c.map((v) => Math.round(v * 255)).join(" ")})`;

function Readout(props: {
  status: Status;
  active: boolean; // an idea with neighbours is showing
  rows: ScanRow[];
  searched: number | null;
  sourceUpdated: boolean;
  similarity: "loading" | "ready" | "unavailable";
  survey: Survey | null;
  total: number;
  onSelect: (id: string) => void;
  onReplay: () => void;
}) {
  const { status, active, rows, searched, sourceUpdated, similarity, survey, total, onSelect, onReplay } = props;

  if (status.intro === "play" && survey) {
    const m = survey.clouds.length;
    const lit = survey.clouds.slice(0, status.lit);
    return (
      <section className={styles.readout} aria-label="Survey" data-mode="intro">
        <header className={styles.head}>
          <span className={styles.name}>Survey</span>
          <span className={styles.phase}>
            {status.lit} / {m} clouds
          </span>
        </header>
        <Meter n={m} done={status.lit} />
        <ol className={styles.log}>
          {lit.slice(-6).map((c) => (
            <li key={c.slot} style={{ "--hue": rgb(c.colour) } as React.CSSProperties}>
              <span className={styles.verb}>cloud</span>
              <span className={styles.num}>{fmt(c.n)}</span>
              <span className={styles.title}>{c.label}</span>
            </li>
          ))}
        </ol>
        <p className={styles.ledger}>
          {fmt(total)} projects · {m} clouds · {fmt(survey.prizes)} prize winners
        </p>
      </section>
    );
  }

  if (!active) return null;
  const n = rows.length;
  const scanning = status.scan === "drain" || status.scan === "reach" || status.scan === "settle";
  const landed = scanning ? Math.min(status.landed, n) : n;
  const phase = status.scan === "drain" ? "placing your idea" : status.scan === "reach" ? `linking ${landed} / ${n}` : status.scan === "settle" ? "settling" : "done";
  const sims = rows.slice(0, landed).flatMap((r) => (r.similarity === null ? [] : [r.similarity])); // only what has landed
  const closest = sims.length ? Math.max(...sims) : null;
  return (
    <section className={styles.readout} aria-label="Scan" data-mode="scan">
      <header className={styles.head}>
        <span className={styles.name}>Scan</span>
        <span className={styles.phase} data-phase={status.scan}>
          {phase}
        </span>
      </header>
      <Meter n={n} done={landed} />
      <ol className={styles.log}>
        {rows.slice(0, landed).map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => onSelect(r.id)} aria-label={`Select ${r.title}`}>
              <span className={styles.verb}>link</span>
              <span className={styles.num}>{r.similarity === null ? (similarity === "loading" ? "…" : "–") : r.similarity.toFixed(2)}</span>
              <span className={styles.title}>{r.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className={styles.foot}>
        <p className={styles.ledger} aria-live="polite">
          {searched === null ? "saved corpus size unavailable" : `${fmt(searched)} projects searched`} · {landed} nearest linked ·{" "}
          {similarity === "unavailable" ? "similarity unavailable" : closest === null ? "closest …" : `closest ${closest.toFixed(2)}`} ·{" "}
          <strong>0 invented</strong>
        </p>
        {sourceUpdated && <p className={styles.ledger}>Saved neighbors are unchanged; similarity uses the current corpus.</p>}
        <button type="button" className={styles.replay} onClick={onReplay} disabled={scanning} aria-label="Replay the scan">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M12 5a7 7 0 1 1-6.6 4.7l1.9.6A5 5 0 1 0 12 7v3L7.5 6 12 2z" />
          </svg>
        </button>
      </div>
    </section>
  );
}

// One segment per arc (or cloud), filled as each lands.
function Meter({ n, done }: { n: number; done: number }) {
  return (
    <div className={styles.meter} aria-hidden style={{ gridTemplateColumns: `repeat(${Math.max(n, 1)}, 1fr)` }}>
      {Array.from({ length: n }, (_, k) => (
        <i key={k} data-on={k < done ? "" : undefined} />
      ))}
    </div>
  );
}

export default memo(Readout);
