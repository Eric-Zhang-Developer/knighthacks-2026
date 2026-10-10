"use client";

import { useEffect, useState } from "react";
import { eraRows, parseToolUse, RELEASES, type ToolUse } from "./era";
import styles from "./era.module.css";

type Star = { id: string; year?: number | null };
const fmt = new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

// When projects were started, beside the AI coding tools of the time. Grouped by start date only: whether a team
// used a coding assistant shows only where its own description says so.
export default function EraBoard({ stars, corpusVersion }: { stars: Star[]; corpusVersion: string }) {
  const [tools, setTools] = useState<ToolUse | null | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/classes")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => !cancelled && setTools(json ? parseToolUse(json, corpusVersion) : null))
      .catch(() => !cancelled && setTools(null));
    return () => {
      cancelled = true;
    };
  }, [corpusVersion]);

  const rows = eraRows(stars, tools === "loading" ? null : tools);
  const known = tools !== "loading" && tools !== null;
  return (
    <section className={styles.board} aria-label="AI tools and eras">
      <h3 className={styles.title}>Before and after AI coding tools</h3>
      <p className={styles.note}>
        Grouped by Devpost&apos;s &ldquo;started this project&rdquo; date, not by when a project was submitted.
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Started</th>
            <th scope="col">Projects</th>
            {known && (
              <>
                <th scope="col">Says it used AI coding tools</th>
                <th scope="col">Says it didn&apos;t</th>
                <th scope="col">Not stated</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-era={r.id}>
              <th scope="row">{r.label}</th>
              <td data-count="projects">{r.count}</td>
              {known && r.tools && (
                <>
                  <td data-count="reported">{r.tools.reported}</td>
                  <td data-count="reported_non_use">{r.tools.reported_non_use}</td>
                  <td data-count="unknown">{r.tools.unknown}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.note}>
        {tools === "loading"
          ? "Loading what teams say about their tools…"
          : known
            ? "“Says it used” counts only teams whose description says they built with a coding assistant. Most don't say either way."
            : "What teams say about their tools isn't loaded for this corpus, so only start dates are shown."}
      </p>
      <h4 className={styles.label}>Tool releases, for context</h4>
      <ol className={styles.releases} aria-label="Tool releases">
        {RELEASES.map((t) => (
          <li key={t.label}>
            <time dateTime={t.date}>{fmt.format(new Date(t.date))}</time>{" "}
            <a href={t.href} target="_blank" rel="noopener noreferrer">
              {t.label}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
