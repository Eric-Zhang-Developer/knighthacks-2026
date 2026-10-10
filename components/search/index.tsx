"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getState, setState, useAppState } from "@/lib/store";
import { resultIds } from "@/lib/search/highlight";
import type { Hit, Neighbor } from "@/lib/search/neighbors";
import { PanelState } from "@/components/ui";
import { parseStars, type Star } from "@/components/galaxy/stars";
import { filterOptions, localMatches, meta, searchUrl, type Filters } from "./filters";
import styles from "./search.module.css";

type Response = { results: Neighbor[]; textMatches: Hit[]; meaning: "ok" | "unavailable" };
type View = { state: "idle" } | { state: "error" } | { state: "done"; data: Response } | { state: "local"; hits: Hit[] };
// ponytail: an empty-query filter lists its first 50 projects (all are highlighted); paginate if people need the rest.
const LOCAL_SHOWN = 50;

export default function Search() {
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>({ state: "idle" });
  const [filters, setFilters] = useState<Filters>({ event: "", year: "" });
  const [stars, setStars] = useState<Star[]>([]);
  const options = useMemo(() => filterOptions(stars), [stars]);
  const selectedId = useAppState((s) => s.selectedProjectId);
  // The selection from before this search; undefined while no search is active.
  const saved = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    fetch("/corpus/stars.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => json && setStars(parseStars(json).stars))
      .catch(() => {}); // no stars.json: no filters, search still works
  }, []);

  useEffect(() => {
    const query = q.trim();
    if (!query && !filters.event && !filters.year) {
      if (saved.current !== undefined) setState({ highlightedIds: [], selectedProjectId: saved.current });
      saved.current = undefined;
      setView({ state: "idle" });
      return;
    }
    if (saved.current === undefined) saved.current = getState().selectedProjectId;
    if (!query) {
      const hits = localMatches(stars, filters);
      setState({ highlightedIds: hits.map((h) => h.id) });
      setView({ state: "local", hits });
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(searchUrl(query, filters), { signal: ctrl.signal });
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
  }, [q, filters, stars]);

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
          {meta(h, filters.event)}
          {similarity !== undefined && ` · ${similarity.toFixed(2)}`}
        </span>
      </button>
    </li>
  );

  const data = view.state === "done" ? view.data : null;
  const textOnly = data ? data.textMatches.filter((t) => !data.results.some((r) => r.id === t.id)) : [];

  return (
    <div className={styles.search} role="search">
      <div className={styles.bar}>
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
        {stars.length > 0 && (
          <>
            <label className={styles.filter}>
              <span className={styles.hidden}>Event</span>
              <select value={filters.event} onChange={(e) => setFilters({ ...filters, event: e.target.value })}>
                <option value="">All events</option>
                {options.events.map((o) => (
                  <option key={o.name} value={o.name}>{`${o.name} (${o.count})`}</option>
                ))}
              </select>
            </label>
            <label className={styles.filter}>
              <span className={styles.hidden}>Created year</span>
              <select value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })}>
                <option value="">Any year</option>
                {options.years.map((y) => (
                  <option key={y} value={y}>{`created ${y}`}</option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>
      {view.state !== "idle" && (
        <div className={`ui-panel ${styles.panel}`} data-panel="search" aria-label="Search results" aria-live="polite">
          {view.state === "error" && <PanelState kind="failed" message="Search is unavailable right now." />}
          {data?.meaning === "unavailable" && (
            <PanelState kind="partial" message="Meaning search unavailable; showing title matches." />
          )}
          {view.state === "local" && (
            <>
              <h2 className={`ui-heading ${styles.heading}`}>
                {view.hits.length > LOCAL_SHOWN ? `Projects (first ${LOCAL_SHOWN} of ${view.hits.length})` : `Projects (${view.hits.length})`}
              </h2>
              {view.hits.length === 0 && <PanelState kind="empty" message="No projects match these filters." />}
              <ul className={styles.list} aria-label="Projects">
                {view.hits.slice(0, LOCAL_SHOWN).map((h) => item(h))}
              </ul>
            </>
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
