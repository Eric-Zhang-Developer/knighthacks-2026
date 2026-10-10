"use client";

import { counts, MIXED, NEUTRAL, PALETTE, setClassFilter, UNCLEAR, useClasses } from "@/lib/classes";
import styles from "./classes.module.css";

const rgb = (c: readonly number[]) => `rgb(${c.map((v) => Math.round(v * 255)).join(" ")})`;

// The map's key: each category with its count, a prize-winner toggle, and a summary of the loaded universe. Every
// number is counted from the loaded files. `ids` and `shown` are the stars on the map before the category filter.
export default function Legend({ ids, shown, events }: { ids: string[]; shown: (i: number) => boolean; events: number }) {
  const load = useClasses((s) => s.load);
  const filter = useClasses((s) => s.filter);

  if (load.state !== "ready") {
    return (
      <section className={`ui-panel ${styles.legend}`} aria-label="Categories">
        <p className={styles.muted}>{load.state === "loading" ? "Loading categories…" : "Categories not loaded"}</p>
      </section>
    );
  }
  const data = load.data;
  const { byKey, prizes } = counts(data, ids, shown, filter.event);
  const entries = [
    ...data.domains.map((d, i) => ({ key: d.id, label: d.label, colour: PALETTE[i % PALETTE.length] })),
    { key: MIXED, label: "Mixed", colour: NEUTRAL },
    { key: UNCLEAR, label: "Not enough text", colour: NEUTRAL },
  ].filter((e) => byKey.get(e.key));
  const filtered = filter.key !== null || filter.prize !== "";

  return (
    <section className={`ui-panel ${styles.legend}`} aria-label="Categories">
      <dl className={styles.universe} aria-label="Universe">
        <div>
          <dt>Projects</dt>
          <dd>{ids.length.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Events</dt>
          <dd>{events.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Categories</dt>
          <dd>{data.domains.filter((d) => byKey.get(d.id)).length}</dd>
        </div>
      </dl>
      <ul className={styles.entries}>
        {entries.map((e) => (
          <li key={e.key}>
            <button
              type="button"
              className={styles.entry}
              aria-pressed={filter.key === e.key}
              data-key={e.key}
              onClick={() => setClassFilter({ key: filter.key === e.key ? null : e.key })}
            >
              <span className={styles.swatch} style={{ background: rgb(e.colour) }} aria-hidden />
              <span className={styles.label}>{e.label}</span>
              <span className={styles.count}>{byKey.get(e.key)!.toLocaleString()}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={styles.entry}
        aria-pressed={filter.prize === "win"}
        onClick={() => setClassFilter({ prize: filter.prize === "win" ? "" : "win" })}
      >
        <span className={styles.ring} aria-hidden />
        <span className={styles.label}>Prize winners</span>
        <span className={styles.count}>{prizes.toLocaleString()}</span>
      </button>
      {filtered && (
        <button type="button" className={styles.reset} onClick={() => setClassFilter({ key: null, prize: "" })}>
          Reset
        </button>
      )}
      <p className={styles.muted}>Categories are inferred by a model from each project&apos;s own text.</p>
    </section>
  );
}
