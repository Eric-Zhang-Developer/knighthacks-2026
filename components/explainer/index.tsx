"use client";

import { useEffect, useState } from "react";
import { summarize } from "./summary";
import styles from "./explainer.module.css";

export default function Explainer() {
  const [summary, setSummary] = useState<ReturnType<typeof summarize> | null>(null);

  useEffect(() => {
    fetch("/corpus/stars.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => Array.isArray(json?.stars) && setSummary(summarize(json.stars)))
      .catch(() => {});
  }, []);

  // No corpus: the galaxy already says so, and there is nothing to explain.
  if (!summary) return null;

  return (
    <details className={styles.panel}>
      <summary>What am I looking at?</summary>
      <div className={styles.body} data-testid="explainer-text">
        <p>
          Each star is one real past hackathon project: <strong data-testid="explainer-count">{summary.count}</strong>{" "}
          projects indexed from {summary.events.length} {summary.events.length === 1 ? "event" : "events"}.
        </p>
        <p>
          Stars sit near each other when their descriptions are similar. Similarity is computed in the full embedding
          space; the 3D layout is only a projection of it, so on-screen distance is approximate.
        </p>
        <p>
          Empty space does not mean an idea is original, useful or likely to win. It may only mean those projects
          aren&apos;t in this corpus.
        </p>
      </div>
      <ul className={styles.body + " " + styles.events} aria-label="Source coverage">
        {summary.events.map(([name, n]) => (
          <li key={name}>
            <span>{name}</span> · {n}
          </li>
        ))}
      </ul>
    </details>
  );
}
