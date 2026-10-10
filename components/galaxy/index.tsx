"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Legend from "@/components/classes";
import History from "@/components/history";
import { initWorkspace } from "@/components/workspace/api";
import { colourOf, compactRegions, keyOf, loadClasses, matches, setFocus, useClasses, wins, type ClassesFile } from "@/lib/classes";
import { setState, useAppState } from "@/lib/store";
import type { Hover } from "./Scene";
import { createdLabel, parseStars, revealMask, yearsOf, type StarsFile } from "./stars";
import styles from "./galaxy.module.css";
import { Viewport } from "./view";

// WebGL only exists in the browser.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

type Load = { state: "loading" } | { state: "missing"; reason?: string } | { state: "ready"; data: StarsFile };

export default function Galaxy() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [hover, setHover] = useState<Hover>(null);
  const [reveal, setReveal] = useState<number | null>(null); // null = every star
  const selectedId = useAppState((s) => s.selectedProjectId);
  const activeIdea = useAppState((s) => s.activeIdeaVersionId);
  const ideaStars = useAppState((s) => s.ideaStars);
  const classes = useClasses((s) => s.load);
  const filter = useClasses((s) => s.filter);
  const focusOn = useClasses((s) => s.focus);
  const [neighbors, setNeighbors] = useState<string[] | null>(null);
  const [labelLayer, setLabelLayer] = useState<HTMLDivElement | null>(null);
  // The 2D view, shared by the scene (input, camera) and the map buttons and keys.
  const view = useMemo(() => new Viewport(), []);
  // The page's discovery rail (experience-shell), if there is one; without it the controls float over the map.
  const [rail, setRail] = useState<HTMLElement | null>(null);
  useEffect(() => setRail(document.getElementById("discovery-rail")), []);

  useEffect(() => {
    fetch("/corpus/stars.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json) return setLoad({ state: "missing" });
        try {
          setLoad({ state: "ready", data: parseStars(json) });
        } catch {
          setLoad({ state: "missing", reason: "stars.json is invalid" });
        }
      })
      .catch(() => setLoad({ state: "missing" }));
  }, []);

  useEffect(() => {
    if (load.state === "ready") loadClasses(load.data.corpus_version);
  }, [load]);
  useEffect(() => {
    let live = true;
    setNeighbors(null);
    setFocus(true); // a new idea is focused again
    if (activeIdea) neighborsOf(activeIdea).then((n) => live && setNeighbors(n));
    return () => {
      live = false;
    };
  }, [activeIdea]);

  const stars = useMemo(() => (load.state === "ready" ? load.data.stars : []), [load]);
  const data: ClassesFile | null = classes.state === "ready" ? classes.data : null;
  const ids = useMemo(() => stars.map((s) => s.id), [stars]);
  const positions = useMemo(() => new Float32Array(stars.flatMap((s) => [s.x, s.y, s.z])), [stars]);
  const years = useMemo(() => yearsOf(stars), [stars]);
  const revealed = useMemo(() => revealMask(stars, reveal), [stars, reveal]);
  // The map, list and legend all use this one mask, so their counts agree under any filter.
  const visible = useMemo(() => Uint8Array.from(revealed, (v, i) => (v && matches(data, ids[i], filter) ? 1 : 0)), [revealed, data, ids, filter]);
  const events = useMemo(() => new Set(stars.flatMap((s) => (s.event ? [s.event] : []))).size, [stars]);
  const colourAt = useMemo(() => (data ? (i: number) => colourOf(data, data.projects[ids[i]]) : undefined), [data, ids]);
  const ringAt = useMemo(() => (data ? (i: number) => wins(data.projects[ids[i]], filter.event).length > 0 : undefined), [data, ids, filter.event]);
  // Idea focus: the active idea's stored neighbours keep their colour, every other star dims, and one line runs to each.
  const focus = useMemo(() => (neighbors && focusOn ? new Set(neighbors) : null), [neighbors, focusOn]);
  const dimAt = useMemo(() => (focus ? (i: number) => !focus.has(ids[i]) : undefined), [focus, ids]);
  const lines = useMemo(() => {
    const from = ideaStars.find((s) => s.versionId === activeIdea);
    if (!from || !focus) return undefined;
    const index = new Map(ids.map((id, i) => [id, i]));
    return new Float32Array(
      [...focus].flatMap((id) => {
        const i = index.get(id);
        return i === undefined ? [] : [from.x, from.y, from.z, positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]];
      }),
    );
  }, [ideaStars, activeIdea, focus, ids, positions]);
  const regions = useMemo(() => (data ? compactRegions(data, ids, positions, (i) => visible[i] === 1) : []), [data, ids, positions, visible]);
  const ringCount = useMemo(() => (ringAt ? ids.filter((_, i) => visible[i] && ringAt(i)).length : 0), [ringAt, ids, visible]);
  const shown = useMemo(() => visible.reduce((n, v) => n + v, 0), [visible]);
  // Clicking empty space clears the selection, which also closes its panel and frees the camera.
  const onPick = useCallback((i: number) => setState({ selectedProjectId: i >= 0 ? ids[i] : null }), [ids]);

  if (load.state !== "ready") {
    return (
      <p role="status" className={styles.status}>
        {load.state === "loading" ? "Loading corpus…" : `Corpus not loaded${load.reason ? ` (${load.reason})` : ""}`}
      </p>
    );
  }

  const hovered = hover ? stars[hover.index] : null;
  return (
    <div
      className={styles.galaxy}
      data-star-count={positions.length / 3}
      data-visible-count={shown}
      data-selected-id={selectedId ?? ""}
      data-classes={classes.state}
      data-ring-count={ringCount}
      data-line-count={lines ? lines.length / 6 : 0}
      data-dimmed-count={focus ? ids.filter((id, i) => visible[i] && !focus.has(id)).length : 0}
      tabIndex={0}
      aria-label="Star map. Drag to move, scroll or pinch to zoom; plus, minus and 0 keys zoom in, out and fit."
      onKeyDown={(e) => {
        const act = ({ "+": () => view.zoomBy(1.6), "=": () => view.zoomBy(1.6), "-": () => view.zoomBy(1 / 1.6), "0": () => view.fit() } as Record<string, () => void>)[e.key];
        if (!act || e.target !== e.currentTarget) return;
        e.preventDefault();
        act();
      }}
    >
      <Scene
        ids={ids}
        positions={positions}
        visible={visible}
        onHover={setHover}
        onPick={onPick}
        view={view}
        colourAt={colourAt}
        ringAt={ringAt}
        dimAt={dimAt}
        lines={lines}
        regions={regions}
        labelLayer={labelLayer}
      />
      <div ref={setLabelLayer} className={styles.regions} aria-hidden>
        {regions.map((g) => (
          <span key={g.key} className={styles.region}>
            {g.label}
            <small>{g.count.toLocaleString()}</small>
          </span>
        ))}
      </div>
      <p role="status" className={styles.status}>
        {stars.length} projects indexed
      </p>
      <div className={styles.mapControls} role="group" aria-label="Map controls">
        <button type="button" aria-label="Zoom in" onClick={() => view.zoomBy(1.6)}>
          <svg viewBox="0 0 24 24" aria-hidden><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" /></svg>
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => view.zoomBy(1 / 1.6)}>
          <svg viewBox="0 0 24 24" aria-hidden><path d="M5 11h14v2H5z" /></svg>
        </button>
        <button type="button" aria-label="Show the whole map" onClick={() => view.fit()}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z" />
          </svg>
        </button>
      </div>
      {hover && hovered && (
        <div role="tooltip" className={styles.tooltip} style={{ left: hover.x + 12, top: hover.y + 12 }}>
          <strong>{hovered.title}</strong>
          <Meta event={hovered.event} year={hovered.year} />
          <Category data={data} id={hovered.id} />
        </div>
      )}
      {portal(
        rail,
        <div className={rail ? styles.railControls : styles.controls}>
        <Legend ids={ids} shown={(i) => revealed[i] === 1} events={events} focusable={neighbors !== null} />
        {years.length > 0 && (
          <History
            years={years}
            reveal={reveal}
            onReveal={setReveal}
            shown={shown}
            total={stars.length}
            unknown={stars.filter((s) => s.year == null).length}
          />
        )}
        <details className={styles.list}>
          <summary>Projects ({stars.length})</summary>
          <ul aria-label="Projects">
            {stars.map((s, i) => (
              <li key={s.id} hidden={!visible[i]}>
                <button
                  type="button"
                  aria-pressed={s.id === selectedId}
                  onClick={() => setState({ selectedProjectId: s.id })}
                >
                  {s.title}
                  <Meta event={s.event} year={s.year} />
                  <Category data={data} id={s.id} />
                </button>
              </li>
            ))}
          </ul>
        </details>
      </div>)}
    </div>
  );
}

// Unknown event or year stays visibly empty rather than guessed. The year is the created year, so it gets its own
// line rather than sitting beside the event as if it were the event date.
function Meta({ event, year }: { event?: string | null; year?: number | null }) {
  return (
    <>
      <span className={styles.meta}>{event ?? "event unknown"}</span>
      <span className={styles.meta}>{createdLabel(year)}</span>
    </>
  );
}

// The project's inferred category and its wins, beside the facts from its page.
function Category({ data, id }: { data: ClassesFile | null; id: string }) {
  const c = data?.projects[id];
  if (!data || !c) return null;
  const key = keyOf(c);
  const label = data.domains.find((d) => d.id === key)?.label ?? (key === "mixed" ? "Mixed" : "Not enough text");
  const w = wins(c);
  return (
    <span className={styles.meta}>
      {label} (inferred)
      {w.length > 0 && ` · ${w.map((p) => (p.kind === "placement" && p.place ? ["1st", "2nd", "3rd"][p.place - 1] : p.sponsor ?? "Sponsor prize")).join(", ")}`}
    </span>
  );
}

// A version's stored neighbours, from the idea it belongs to. The latest versions come from /api/ideas; an older or
// branch version from its idea's trail.
type Version = { versionId: string; ideaId: string; neighborIds: string[] };
async function neighborsOf(versionId: string): Promise<string[] | null> {
  if (!(await initWorkspace()).ok) return null;
  const get = (path: string) => fetch(path).then((r) => (r.ok ? (r.json() as Promise<Version[]>) : [])).catch(() => [] as Version[]);
  const latest = await get("/api/ideas");
  const hit = latest.find((v) => v.versionId === versionId);
  if (hit) return hit.neighborIds;
  for (const idea of latest) {
    const v = (await get(`/api/revisions/trail/${idea.ideaId}`)).find((x) => x.versionId === versionId);
    if (v) return v.neighborIds;
  }
  return null;
}

const portal = (target: HTMLElement | null, node: React.ReactNode) => (target ? createPortal(node, target) : node);
