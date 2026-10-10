"use client";

import { useEffect, useRef, useState } from "react";
import { getState, setState, useAppState } from "@/lib/store";
import { resultIds } from "@/lib/search/highlight";
import type { Hit, Neighbor } from "@/lib/search/neighbors";
import { PanelState } from "@/components/ui";
import styles from "./search.module.css";

type Response = { results: Neighbor[]; textMatches: Hit[]; meaning: "ok" | "unavailable" };
type View = { state: "idle" } | { state: "error" } | { state: "done"; data: Response };

const meta = (h: Hit) => [h.event, h.year].filter(Boolean).join(" · ");

export default function Search() {
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>({ state: "idle" });
  const selectedId = useAppState((s) => s.selectedProjectId);
  // The selection from before this search; undefined while no search is active.
  const saved = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      if (saved.current !== undefined) setState({ highlightedIds: [], selectedProjectId: saved.current });
      saved.current = undefined;
      setView({ state: "idle" });
      return;
    }
    if (saved.current === undefined) saved.current = getState().selectedProjectId;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Response;
        setState({ highlightedIds: resultIds(data) });
        setView({ state: "done", data });
      } catch {
        if (!ctrl.signal.aborted) setView({ state: "error" });
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  const item = (h: Hit, similarity?: number) => (
    <li key={h.id}>
      <button
        type="button"
        className={styles.item}
        aria-current={h.id === selectedId}
        onClick={() => setState({ selectedProjectId: h.id })}
      >
        <span>{h.title}</span>
        <span className={styles.meta}>
          {meta(h)}
          {similarity !== undefined && ` · ${similarity.toFixed(2)}`}
        </span>
      </button>
    </li>
  );

  const data = view.state === "done" ? view.data : null;
  const textOnly = data ? data.textMatches.filter((t) => !data.results.some((r) => r.id === t.id)) : [];

  return (
    <div className={styles.search} role="search">
      <input
        type="search"
        className={styles.input}
        aria-label="Search projects"
        placeholder="Search projects by meaning or title"
        maxLength={500}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setQ("")}
      />
      {view.state !== "idle" && (
        <div className={`ui-panel ${styles.panel}`} data-panel="search" aria-label="Search results" aria-live="polite">
          {view.state === "error" && <PanelState kind="failed" message="Search is unavailable right now." />}
          {data?.meaning === "unavailable" && (
            <PanelState kind="partial" message="Meaning search unavailable; showing title matches." />
          )}
          {data && data.results.length + textOnly.length === 0 && <PanelState kind="empty" message="No matches." />}
          {data && data.results.length > 0 && (
            <>
              <h2 className={`ui-heading ${styles.heading}`}>Similar projects</h2>
              <ul className={styles.list} aria-label="Similar projects">
                {data.results.map((r) => item(r, r.similarity))}
              </ul>
            </>
          )}
          {textOnly.length > 0 && (
            <>
              <h2 className={`ui-heading ${styles.heading}`}>Title matches</h2>
              <ul className={styles.list} aria-label="Title matches">
                {textOnly.map((t) => item(t))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
