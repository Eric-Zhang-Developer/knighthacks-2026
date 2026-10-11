"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getState, setState, useAppState } from "@/lib/store";
import { resultIds } from "@/lib/search/highlight";
import type { Hit, Neighbor } from "@/lib/search/neighbors";
import { PanelState } from "@/components/ui";
import { loadStars, type Star } from "@/components/galaxy/stars";
import { MIXED, matches, setClassFilter, UNCLEAR, useClasses, type PrizeFilter } from "@/lib/classes";
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
  const classes = useClasses((s) => s.load);
  const classFilter = useClasses((s) => s.filter);
  const classData = classes.state === "ready" ? classes.data : null;
  // Category and prize filter what search returns; they never change how it ranks.
  const keep = useMemo(() => (h: { id: string }) => matches(classData, h.id, classFilter), [classData, classFilter]);
  // The selection from before this search; undefined while no search is active.
  const saved = useRef<string | null | undefined>(undefined);
  // The results panel folds away (query and highlights kept) on a pick, a click outside it, or Escape (#457).
  const [open, setOpen] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const shown = open && view.state !== "idle";

  useEffect(() => {
    if (!shown) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [shown]);

  useEffect(() => {
    loadStars().then((l) => l.state === "ready" && setStars(l.data.stars)); // no stars.json: no filters, search still works
  }, []);

  useEffect(() => {
    const query = q.trim();
    // Category and prize alone show on the map, legend and list; only a query, event or year opens this panel.
    if (!query && !filters.event && !filters.year) {
      if (saved.current !== undefined) setState({ highlightedIds: [], selectedProjectId: saved.current });
      saved.current = undefined;
      setView({ state: "idle" });
      return;
    }
    if (saved.current === undefined) saved.current = getState().selectedProjectId;
    if (!query) {
      const hits = localMatches(stars, filters).filter(keep);
      setState({ highlightedIds: hits.map((h) => h.id) });
      setView({ state: "local", hits });
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(searchUrl(query, filters), { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        setView({ state: "done", data: (await res.json()) as Response });
      } catch {
        if (!ctrl.signal.aborted) setView({ state: "error" });
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, filters, stars, keep]);

  const data = useMemo(() => {
    if (view.state !== "done") return null;
    return { ...view.data, results: view.data.results.filter(keep), textMatches: view.data.textMatches.filter(keep) };
  }, [view, keep]);
  useEffect(() => {
    if (data) setState({ highlightedIds: resultIds(data) });
  }, [data]);

  const item = (h: Hit, similarity?: number) => (
    <li key={h.id}>
      <button
        type="button"
        className={styles.item}
        aria-current={h.id === selectedId}
        onClick={() => {
          setState({ selectedProjectId: h.id });
          setOpen(false);
        }}
      >
        <span>{h.title}</span>
        <span className={styles.meta}>
          {meta(h, filters.event)}
          {similarity !== undefined && ` · ${similarity.toFixed(2)}`}
        </span>
      </button>
    </li>
  );

  const textOnly = data ? data.textMatches.filter((t) => !data.results.some((r) => r.id === t.id)) : [];

  return (
    <div className={styles.search} role="search" ref={root}>
      <div className={styles.bar}>
        <input
          type="search"
          className={styles.input}
          aria-label="Search projects"
          placeholder="Search ideas and projects"
          maxLength={500}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          // The first Escape folds the results away; with them folded, Escape clears the query.
          onKeyDown={(e) => e.key === "Escape" && (shown ? setOpen(false) : setQ(""))}
        />
        {stars.length > 0 && (
          <details className={styles.filterMenu}>
            <summary>Filters{filters.event || filters.year || classFilter.key || classFilter.prize ? " · active" : ""}</summary>
            <div className={styles.filterSheet}>
            <label className={styles.filter}>
              <span>Event</span>
              <select
                value={filters.event}
                onChange={(e) => {
                  setFilters({ ...filters, event: e.target.value });
                  setOpen(true);
                  setClassFilter({ event: e.target.value || null }); // prize marks then count only this event's prizes
                }}
              >
                <option value="">All events</option>
                {options.events.map((o) => (
                  <option key={o.name} value={o.name}>{`${o.name} (${o.count})`}</option>
                ))}
              </select>
            </label>
            <label className={styles.filter}>
              <span>Created year</span>
              <select
                value={filters.year}
                onChange={(e) => {
                  setFilters({ ...filters, year: e.target.value });
                  setOpen(true);
                }}
              >
                <option value="">Any year</option>
                {options.years.map((y) => (
                  <option key={y} value={y}>{`created ${y}`}</option>
                ))}
              </select>
            </label>
            {classData && (
              <>
                <label className={styles.filter}>
                  <span>Category</span>
                  <select value={classFilter.key ?? ""} onChange={(e) => setClassFilter({ key: e.target.value || null })}>
                    <option value="">All categories</option>
                    {classData.domains.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                    <option value={MIXED}>Mixed</option>
                    <option value={UNCLEAR}>Not enough text</option>
                  </select>
                </label>
                <label className={styles.filter}>
                  <span>Prize</span>
                  <select value={classFilter.prize} onChange={(e) => setClassFilter({ prize: e.target.value as PrizeFilter })}>
                    <option value="">Any project</option>
                    <option value="win">Any prize winner</option>
                    <option value="1">1st place</option>
                    <option value="2">2nd place</option>
                    <option value="3">3rd place</option>
                    <option value="sponsor">Sponsor prize</option>
                  </select>
                </label>
              </>
            )}
              <button type="button" onClick={() => { setFilters({ event: "", year: "" }); setClassFilter({ event: null, key: null, prize: "" }); }}>Clear filters</button>
            </div>
          </details>
        )}
      </div>
      {shown && (
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
