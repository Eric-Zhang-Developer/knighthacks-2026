"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import EraBoard from "@/components/era";
import { loadStars } from "@/components/galaxy/stars";
import { summarize } from "./summary";
import styles from "./explainer.module.css";

export default function Explainer() {
  const [summary, setSummary] = useState<ReturnType<typeof summarize> | null>(null);
  const [corpus, setCorpus] = useState<{ version: string; stars: { id: string; year?: number | null }[] } | null>(null);

  useEffect(() => {
    loadStars().then((l) => {
      if (l.state !== "ready") return;
      setSummary(summarize(l.data.stars));
      setCorpus({ version: l.data.corpus_version, stars: l.data.stars });
    });
  }, []);

  // Always in view, not inside the folded panel: judges should find how the product was built without hunting.
  const built = (
    <Link href="/foreman" className={styles.built} data-testid="explainer-built">
      How this was built <span aria-hidden>→</span>
    </Link>
  );

  // No corpus: the galaxy already says so, and there is nothing to explain.
  if (!summary) return <div className={styles.dock}>{built}</div>;

  return (
    <div className={styles.dock}>
      {built}
      <details className={`ui-panel ${styles.panel}`} data-panel="explainer">
        <summary className="ui-heading">What am I looking at?</summary>
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
        {corpus && <EraBoard stars={corpus.stars} corpusVersion={corpus.version} />}
      </details>
    </div>
  );
}
