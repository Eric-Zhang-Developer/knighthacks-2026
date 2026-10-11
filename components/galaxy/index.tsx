"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Legend from "@/components/classes";
import History from "@/components/history";
import Readout, { type ScanRow, type Survey } from "@/components/scan";
import { Director, type Status } from "@/components/scan/director";
import { initWorkspace } from "@/components/workspace/api";
import { colourOf, compactRegions, keyOf, loadClasses, matches, MIXED, setFocus, UNCLEAR, useClasses, wins, type ClassesFile } from "@/lib/classes";
import { setState, useAppState } from "@/lib/store";
import { layoutOf, type LayoutName } from "./layouts";
import type { Hover, Idea } from "./Scene";
import { createdLabel, loadStars, NAME_MAX, revealMask, shortTitle, yearsOf, type Star, type StarsFile } from "./stars";
import styles from "./galaxy.module.css";
import { Orbit } from "./view";

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
  const [nameLayer, setNameLayer] = useState<HTMLDivElement | null>(null);
  // The 3D camera, shared by the scene (input, drift) and the map buttons and keys.
  const view = useMemo(() => new Orbit(), []);
  // The idea scan and the intro (specs/features/idea-scan): one clock for the scene and the readout.
  const director = useMemo(() => new Director(), []);
  const [scanStatus, setScanStatus] = useState<Status>(director.status);
  useEffect(() => director.subscribe(setScanStatus), [director]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => (director.reduced = mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [director]);
  const [tagLayer, setTagLayer] = useState<HTMLDivElement | null>(null);
  const [scan, setScan] = useState<ScanLoad>({ state: "loading" });
  // Which layout the stars sit in, from ?layout= (default clouds); switching flies every star across.
  const [layout, setLayout] = useState<LayoutName>("clouds");
  useEffect(() => {
    if (new URLSearchParams(location.search).get("layout") === "nebula") setLayout("nebula");
  }, []);
  const switchLayout = useCallback((to: LayoutName) => {
    setLayout(to);
    const url = new URL(location.href);
    url.searchParams.set("layout", to);
    window.history.replaceState(window.history.state, "", url);
  }, []);
  // The page's discovery rail (experience-shell), if there is one; without it the controls float over the map.
  const [rail, setRail] = useState<HTMLElement | null>(null);
  useEffect(() => setRail(document.getElementById("discovery-rail")), []);

  useEffect(() => {
    loadStars().then(setLoad);
  }, []);

  useEffect(() => {
    if (load.state === "ready") loadClasses(load.data.corpus_version);
  }, [load]);
  useEffect(() => {
    let live = true;
    setNeighbors(null);
    setFocus(true); // a new idea is focused again
    setScan({ state: "loading" });
    if (activeIdea) neighborsOf(activeIdea).then((n) => live && setNeighbors(n));
    // The neighbours' real similarity, for the scan's tags; the scan itself never waits for it.
    if (activeIdea) scanOf(activeIdea).then((r) => live && setScan(r));
    return () => {
      live = false;
    };
  }, [activeIdea]);

  const stars = useMemo(() => (load.state === "ready" ? load.data.stars : []), [load]);
  const data: ClassesFile | null = classes.state === "ready" ? classes.data : null;
  const ids = useMemo(() => stars.map((s) => s.id), [stars]);
  const titles = useMemo(() => stars.map((s) => s.title), [stars]);
  const positions = useMemo(() => layoutOf(layout, stars, data), [layout, stars, data]);
  const years = useMemo(() => yearsOf(stars), [stars]);
  const revealed = useMemo(() => revealMask(stars, reveal), [stars, reveal]);
  // The map, list and legend all use this one mask, so their counts agree under any filter.
  const visible = useMemo(() => Uint8Array.from(revealed, (v, i) => (v && matches(data, ids[i], filter) ? 1 : 0)), [revealed, data, ids, filter]);
  const events = useMemo(() => new Set(stars.flatMap((s) => (s.event ? [s.event] : []))).size, [stars]);
  const colourAt = useMemo(() => (data ? (i: number) => colourOf(data, data.projects[ids[i]]) : undefined), [data, ids]);
  const ringAt = useMemo(() => (data ? (i: number) => wins(data.projects[ids[i]], filter.event).length > 0 : undefined), [data, ids, filter.event]);
  // Idea focus: the active idea's stored neighbours keep their colour, every other star dims, and one line runs to each.
  // The scene's star shader draws the dimming, so the scan can settle into it; it starts once the scan has this idea.
  const scanHas = scanStatus.key === activeIdea;
  const focus = useMemo(() => (neighbors && focusOn && scanHas ? new Set(neighbors) : null), [neighbors, focusOn, scanHas]);
  // Each star's category slot (domains in the file's order, then mixed, then not enough text), for the scan's shader.
  const slots = useMemo(() => (data ? [...data.domains.map((d) => d.id), MIXED, UNCLEAR] : []), [data]);
  const cats = useMemo(
    () => (data ? Float32Array.from(ids, (id) => (keyOf(data.projects[id]) === null ? -1 : slots.indexOf(keyOf(data.projects[id])!))) : undefined),
    [data, ids, slots],
  );
  // The active idea: placed among its stored neighbours in whichever layout is showing, with an arc to each while
  // focused.
  const idea = useMemo((): Idea | null => {
    const from = ideaStars.find((s) => s.versionId === activeIdea);
    if (!from) return null;
    const index = new Map(ids.map((id, i) => [id, i]));
    const neighbours = (neighbors ?? []).flatMap((id) => index.get(id) ?? []);
    return { neighbours, own: [from.x, from.y, from.z], lines: focus !== null };
  }, [ideaStars, activeIdea, neighbors, focus, ids]);
  const regions = useMemo(
    () =>
      data
        ? compactRegions(data, ids, positions, (i) => visible[i] === 1).map((g) => ({
            ...g,
            slot: slots.indexOf(g.key),
            colour: colourOf(data, { domain: g.key, status: "clear", prizes: [] }) ?? [1, 1, 1],
          }))
        : [],
    [data, ids, positions, visible, slots],
  );
  const ringCount = useMemo(() => (ringAt ? ids.filter((_, i) => visible[i] && ringAt(i)).length : 0), [ringAt, ids, visible]);
  const shown = useMemo(() => visible.reduce((n, v) => n + v, 0), [visible]);
  const dimmed = useMemo(() => (focus ? ids.filter((id, i) => visible[i] && !focus.has(id)).length : 0), [focus, ids, visible]);
  const unknownYear = useMemo(() => stars.filter((s) => s.year == null).length, [stars]);
  const shownAt = useCallback((i: number) => revealed[i] === 1, [revealed]);
  // A hover re-renders the galaxy on every pointer move; these don't depend on it, so the same elements are reused.
  const focusable = neighbors !== null;
  const legend = useMemo(() => <Legend ids={ids} shown={shownAt} events={events} focusable={focusable} />, [ids, shownAt, events, focusable]);
  const history = useMemo(
    () =>
      years.length > 0 && <History years={years} reveal={reveal} onReveal={setReveal} shown={shown} total={stars.length} unknown={unknownYear} />,
    [years, reveal, shown, stars.length, unknownYear],
  );
  // The scan plays once per idea version in this page, when its neighbours are known (and categories have loaded or
  // failed); Replay plays it again.
  const played = useRef(new Set<string>());
  const playScan = useCallback(
    (key: string) => {
      if (!idea || idea.neighbours.length === 0) return;
      played.current.add(key);
      director.startScan(key, idea.neighbours.map((i) => (cats ? cats[i] : -1)), performance.now() / 1000);
    },
    [idea, cats, director],
  );
  useEffect(() => {
    if (!activeIdea || !neighbors || !idea || classes.state === "loading" || played.current.has(activeIdea)) return;
    playScan(activeIdea);
  }, [activeIdea, neighbors, idea, classes.state, playScan]);
  const scanRows = useMemo((): ScanRow[] => {
    const sim = scan.state === "ready" ? new Map(scan.neighbors.map((n) => [n.id, n.similarity])) : null;
    const index = new Map(ids.map((id, i) => [id, i]));
    return (neighbors ?? []).flatMap((id) => (index.has(id) ? [{ id, title: titles[index.get(id)!], similarity: sim?.get(id) ?? null }] : []));
  }, [neighbors, scan, ids, titles]);
  // The intro: every category, largest first, with its real count; at /?intro or from the map's play button.
  const survey = useMemo((): Survey | null => {
    if (!data) return null;
    const count = new Map<number, number>();
    let prizes = 0;
    ids.forEach((id, i) => {
      const c = cats?.[i] ?? -1;
      if (c >= 0) count.set(c, (count.get(c) ?? 0) + 1);
      if (wins(data.projects[id]).length > 0) prizes++;
    });
    const label = (slot: number) => data.domains.find((d) => d.id === slots[slot])?.label ?? (slots[slot] === MIXED ? "Mixed" : "Not enough text");
    const hue = (slot: number) => {
      const key = slots[slot];
      const status = key === MIXED ? "mixed" : key === UNCLEAR ? "insufficient_text" : "clear";
      return colourOf(data, { domain: key, status, prizes: [] } as Parameters<typeof colourOf>[1]) ?? [1, 1, 1];
    };
    const clouds = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([slot, n]) => ({ slot, n, label: label(slot), colour: hue(slot) }));
    return { clouds, prizes };
  }, [data, ids, cats, slots]);
  const playIntro = useCallback(() => {
    if (survey) director.startIntro(survey.clouds.map((c) => c.slot), performance.now() / 1000);
  }, [survey, director]);
  const introAsked = useRef(false);
  useEffect(() => {
    if (introAsked.current || !survey || !new URLSearchParams(location.search).has("intro")) return;
    introAsked.current = true;
    playIntro();
  }, [survey, playIntro]);

  // A wheel over a name zooms the map, as it would a hair to the side.
  const passWheel = useCallback((e: React.WheelEvent) => {
    e.currentTarget.parentElement?.querySelector("canvas")?.dispatchEvent(new WheelEvent("wheel", e.nativeEvent));
  }, []);
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
      data-line-count={idea?.lines ? idea.neighbours.length : 0}
      data-layout={layout}
      data-dimmed-count={dimmed}
      data-scan={scanStatus.key === activeIdea && activeIdea ? scanStatus.scan : "idle"}
      data-intro={scanStatus.intro}
      tabIndex={0}
      aria-label="Star map. Drag to move across it, option-drag to turn it, scroll or pinch to zoom where you point; plus, minus and 0 keys zoom in, out and fit."
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
        idea={idea}
        regions={regions}
        labelLayer={labelLayer}
        titles={titles}
        nameLayer={nameLayer}
        director={director}
        cats={cats}
        tagLayer={tagLayer}
      />
      {/* The scan's tags: each neighbour's real similarity and title, placed beside its star by the scene. */}
      <div ref={setTagLayer} className={styles.tags} role="group" aria-label="Nearest projects to your idea" onWheel={passWheel}>
        {scanRows.slice(0, 8).map((r) => (
          <button key={r.id} type="button" aria-label={`Select ${r.title}${r.similarity === null ? "" : `, similarity ${r.similarity.toFixed(2)}`}`} onClick={() => setState({ selectedProjectId: r.id })}>
            {r.similarity !== null && <b>{r.similarity.toFixed(2)}</b>}
            <span>{shortTitle(r.title)}</span>
          </button>
        ))}
      </div>
      {/* Zoomed in, the nearest projects' names: filled and placed by the scene; a name selects its project. */}
      <div ref={setNameLayer} className={styles.names} role="group" aria-label="Projects near the middle" onWheel={passWheel}>
        {Array.from({ length: NAME_MAX }, (_, k) => (
          <button key={k} type="button" onClick={(e) => onPick(Number(e.currentTarget.dataset.index))} />
        ))}
      </div>
      {/* A cloud's name flies the camera to that cloud. */}
      <div ref={setLabelLayer} className={styles.regions} onWheel={passWheel}>
        {regions.map((g) => (
          <span key={g.key} className={styles.region} style={{ "--hue": `rgb(${g.colour.map((c) => Math.round(c * 255)).join(" ")})` } as React.CSSProperties}>
            <button type="button" aria-label={`Go to ${g.label}, ${g.count.toLocaleString()} projects`} onClick={() => view.flyToCloud([g.at[0], g.at[1], g.at[2]])}>
              {g.label}
              <small> · {g.count.toLocaleString()}</small>
            </button>
          </span>
        ))}
      </div>
      <div className={styles.layouts} role="group" aria-label="Arrange stars">
        {(
          [
            ["clouds", "By category"],
            ["nebula", "By meaning"],
          ] as const
        ).map(([name, label]) => (
          <button key={name} type="button" aria-pressed={layout === name} onClick={() => switchLayout(name)}>
            {label}
          </button>
        ))}
      </div>
      <p role="status" className={styles.status}>
        {stars.length.toLocaleString()} projects indexed
      </p>
      <div className={styles.mapControls} role="group" aria-label="Map controls">
        <button type="button" aria-label="Zoom in" onClick={() => view.zoomBy(1.6)}>
          <svg viewBox="0 0 24 24" aria-hidden><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" /></svg>
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => view.zoomBy(1 / 1.6)}>
          <svg viewBox="0 0 24 24" aria-hidden><path d="M5 11h14v2H5z" /></svg>
        </button>
        <button type="button" aria-label="Play the intro" onClick={playIntro} disabled={!survey}>
          <svg viewBox="0 0 24 24" aria-hidden><path d="M8 5.5v13l10.5-6.5z" /></svg>
        </button>
        <button type="button" aria-label="Show the whole map" onClick={() => view.fit()}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z" />
          </svg>
        </button>
      </div>
      <Readout
        status={scanStatus}
        active={Boolean(activeIdea && neighbors && neighbors.length > 0)}
        rows={scanRows}
        searched={scan.state === "ready" ? scan.searched : stars.length}
        similarity={scan.state}
        survey={survey}
        total={stars.length}
        onSelect={(id) => setState({ selectedProjectId: id })}
        onReplay={() => activeIdea && playScan(activeIdea)}
      />
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
          {legend}
          {history}
          <ProjectList stars={stars} visible={visible} selectedId={selectedId} data={data} />
        </div>,
      )}
    </div>
  );
}

// Memoised, so a hover (which re-renders the galaxy) doesn't re-render every row; and its rows exist only while it's
// open, so a collapsed list costs nothing at any corpus size.
// ponytail: an open list renders every visible row (100k at full scale); window it if people browse it at that size.
const ProjectList = memo(function ProjectList(props: { stars: Star[]; visible: Uint8Array; selectedId: string | null; data: ClassesFile | null }) {
  const { stars, visible, selectedId, data } = props;
  const [open, setOpen] = useState(false);
  return (
    <details className={styles.list} onToggle={(e) => setOpen(e.currentTarget.open)}>
      {/* Click (Enter on a summary is one) renders the rows at once: toggle fires a task later, after a quick Tab. */}
      <summary onClick={(e) => setOpen(!(e.currentTarget.parentElement as HTMLDetailsElement).open)}>Projects ({stars.length})</summary>
      <ul aria-label="Projects">
        {open &&
          stars.map((s, i) =>
            visible[i] ? (
              <li key={s.id}>
                <button type="button" aria-pressed={s.id === selectedId} onClick={() => setState({ selectedProjectId: s.id })}>
                  {s.title}
                  <Meta event={s.event} year={s.year} />
                  <Category data={data} id={s.id} />
                </button>
              </li>
            ) : null,
          )}
      </ul>
    </details>
  );
});

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

// The scan's similarity for a version's neighbours (specs/features/idea-scan); a failure is shown, never filled in.
type ScanLoad = { state: "loading" } | { state: "unavailable" } | { state: "ready"; searched: number; neighbors: { id: string; similarity: number }[] };
async function scanOf(versionId: string): Promise<ScanLoad> {
  if (!(await initWorkspace()).ok) return { state: "unavailable" };
  try {
    const r = await fetch(`/api/scan/${versionId}`);
    if (!r.ok) return { state: "unavailable" };
    const body = (await r.json()) as { searched: number; neighbors: { id: string; similarity: number }[] };
    return { state: "ready", searched: body.searched, neighbors: body.neighbors };
  } catch {
    return { state: "unavailable" };
  }
}

const portal = (target: HTMLElement | null, node: React.ReactNode) => (target ? createPortal(node, target) : node);
