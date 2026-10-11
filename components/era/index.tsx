"use client";

import { useEffect, useState } from "react";
import { eraRows, parseToolUse, RELEASES, type ToolUse } from "./era";
import styles from "./era.module.css";

type Star = { id: string; year?: number | null };
const num = new Intl.NumberFormat("en");
const TOOL_LABELS = [
  ["reported", "Used AI tools"],
  ["reported_non_use", "Said they didn't"],
  ["unknown", "Not stated"],
] as const;
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
        Grouped by Devpost&apos;s &ldquo;started this project&rdquo; date, not by when a project was submitted. Tool use
        is what each team&apos;s own description says.
      </p>
      <ol className={styles.eras} aria-label="Projects by start date">
        {rows.map((r) => (
          <li key={r.id} data-era={r.id}>
            <p className={styles.eraHead}>
              <span>{r.label}</span>
              <span className={styles.figure} data-count="projects" data-value={r.count}>
                {num.format(r.count)}
              </span>
            </p>
            {known && r.tools && (
              <>
                {r.count > 0 && (
                  <span className={styles.bar} aria-hidden="true">
                    <span className={styles.used} style={{ flexGrow: r.tools.reported }} />
                    <span className={styles.didnt} style={{ flexGrow: r.tools.reported_non_use }} />
                    <span className={styles.unstated} style={{ flexGrow: r.tools.unknown }} />
                  </span>
                )}
                <dl className={styles.tools}>
                  {TOOL_LABELS.map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd className={styles.figure} data-count={key} data-value={r.tools![key]}>
                        {num.format(r.tools![key])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </li>
        ))}
      </ol>
      <p className={styles.note}>
        {tools === "loading"
          ? "Loading what teams say about their tools…"
          : known
            ? "“Used AI tools” counts only teams whose description says they built with a coding assistant. Most don't say either way."
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
