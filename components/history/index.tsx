"use client";

import { useEffect, useState } from "react";
import styles from "./history.module.css";

const SPEEDS = [0.5, 1, 2]; // years per second

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

// Reveals stars by the year their project page was created. `years` are the distinct years in stars.json, ascending.
export default function History(props: {
  years: number[];
  reveal: number | null;
  onReveal: (year: number | null) => void;
  shown: number;
  total: number;
  unknown: number;
}) {
  const { years, reveal, onReveal, shown, total, unknown } = props;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const reduced = useReducedMotion();
  const index = reveal === null ? years.length - 1 : years.indexOf(reveal);
  const atEnd = reveal === null || index === years.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (atEnd) return setPlaying(false);
    const t = setTimeout(() => onReveal(years[index + 1]), 1000 / speed);
    return () => clearTimeout(t);
  }, [playing, atEnd, index, years, speed, onReveal]);

  // Starting over from the end begins at the earliest year.
  const next = () => onReveal(atEnd ? years[0] : years[index + 1]);
  const play = () => {
    if (atEnd) onReveal(years[0]);
    setPlaying(true);
  };

  return (
    <div className={`ui-panel ${styles.history}`} role="group" aria-label="Reveal by created year">
      {reduced ? (
        <button type="button" onClick={next}>
          Step
        </button>
      ) : (
        <button type="button" onClick={playing ? () => setPlaying(false) : play}>
          {playing ? "Pause" : "Play"}
        </button>
      )}
      <input
        type="range"
        aria-label="Created year"
        min={0}
        max={years.length - 1}
        value={index}
        onChange={(e) => {
          setPlaying(false);
          onReveal(years[Number(e.target.value)]);
        }}
      />
      {!reduced && (
        <select aria-label="Speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s} yr/s
            </option>
          ))}
        </select>
      )}
      <button type="button" disabled={reveal === null} onClick={() => {
          setPlaying(false);
          onReveal(null);
        }}>
        All
      </button>
      <p className={styles.label} aria-live="polite">
        {reveal === null ? "All years" : `Created through ${reveal}`} · {shown.toLocaleString()} of {total.toLocaleString()} shown
        {unknown > 0 && ` · ${unknown.toLocaleString()} date unknown`}
      </p>
    </div>
  );
}
