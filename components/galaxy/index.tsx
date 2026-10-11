"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Legend from "@/components/classes";
import History from "@/components/history";
import Readout, { type ScanRow, type Survey } from "@/components/scan";
import { Director, SCAN, type Status } from "@/components/scan/director";
import { BEAT_AT, findTwins, Story, TWIN_AT, type Beat, type StoryState } from "@/components/scan/story";
import StoryOverlay from "@/components/scan/StoryOverlay";
import { initWorkspace } from "@/components/workspace/api";
import { colourOf, compactRegions, keyOf, loadClasses, matches, MIXED, setFocus, UNCLEAR, useClasses, wins, type ClassesFile } from "@/lib/classes";
import { setState, useAppState } from "@/lib/store";
import { layoutOf, type LayoutName } from "./layouts";
import type { Hover, Idea, StoryScene } from "./Scene";
import { createdLabel, loadStars, NAME_MAX, revealMask, shortTitle, yearsOf, type Star, type StarsFile } from "./stars";
import styles from "./galaxy.module.css";
import { Orbit, type Vec3 } from "./view";

// The story's scan is keyed apart from any saved idea's version id, so it never counts as one's scan.
const STORY_KEY = "story";

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
  // The active idea's stored neighbours, keyed by idea: when the active idea changes, the previous idea's list must
  // never stand in for the new one's, or the scan starts (and frames the camera) on the old neighbours (#458).
  const [near, setNear] = useState<{ key: string; ids: string[] | null } | null>(null);
  const neighbors = near && near.key === activeIdea ? near.ids : null;
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
    setParam("layout", to);
  }, []);
  // Plain stars (?colors=off): category colour off, so "By meaning" reads as one field; the idea's neighbours keep
  // theirs, so a scan lights its matches in colour against it.
  const [plain, setPlain] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("colors") === "off") setPlain(true);
  }, []);
  const togglePlain = () => {
    setParam("colors", plain ? null : "off");
    setPlain(!plain);
  };
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
    setFocus(true); // a new idea is focused again
    setScan({ state: "loading" });
    if (activeIdea) neighborsOf(activeIdea).then((ids) => live && setNear({ key: activeIdea, ids }));
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
  // The search's event filter narrows the stars too (#459: the list showed one event while every star stayed lit).
  const visible = useMemo(
    () => Uint8Array.from(revealed, (v, i) => (v && (!filter.event || stars[i].event === filter.event) && matches(data, ids[i], filter) ? 1 : 0)),
    [revealed, data, ids, filter, stars],
  );
  const events = useMemo(() => new Set(stars.flatMap((s) => (s.event ? [s.event] : []))).size, [stars]);
  const kept = plain ? neighbors : null;
  const colourAt = useMemo(() => {
    if (!data) return undefined;
    const keep = plain ? new Set(kept ?? []) : null;
    return (i: number) => (keep && !keep.has(ids[i]) ? null : colourOf(data, data.projects[ids[i]]));
  }, [data, ids, plain, kept]);
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
      // By meaning, a category spans the whole map, so its centre is the map's middle: no labels there.
      data && layout === "clouds"
        ? compactRegions(data, ids, positions, (i) => visible[i] === 1).map((g) => ({
            ...g,
            slot: slots.indexOf(g.key),
            colour: colourOf(data, { domain: g.key, status: "clear", prizes: [] }) ?? [1, 1, 1],
          }))
        : [],
    [data, ids, positions, visible, slots, layout],
  );
  const ringCount = useMemo(() => (ringAt ? ids.filter((_, i) => visible[i] && ringAt(i)).length : 0), [ringAt, ids, visible]);
  const shown = useMemo(() => visible.reduce((n, v) => n + v, 0), [visible]);
  // The project list (specs/decisions/galaxy-project-list.md): one row per visible star stopped being usable at 57k.
  // A few stars (a narrow filter) are all listed; otherwise, over the whole map it lists the clouds, each flying the
  // camera in, and zoomed in (or without categories) the projects nearest the middle of the view, from the scene.
  const [listOpen, setListOpen] = useState(false);
  const [nearby, setNearby] = useState<Nearby>({ ids: [], zoomed: false });
  const onNearby = useCallback((ids: number[], zoomed: boolean) => setNearby({ ids, zoomed }), []);
  const listHeld = useRef(false); // pointer or focus in the list: its rows stay put
  const nearbyHold = useCallback(() => listHeld.current, []);
  const onListHold = useCallback((held: boolean) => void (listHeld.current = held), []);
  const listClouds = useMemo((): ListCloud[] => {
    if (!data || !cats) return [];
    const sum = new Map<number, number[]>(); // slot -> [x, y, z, count]
    for (let i = 0; i < cats.length; i++) {
      if (!visible[i] || cats[i] < 0) continue;
      const a = sum.get(cats[i]) ?? [0, 0, 0, 0];
      a[0] += positions[3 * i];
      a[1] += positions[3 * i + 1];
      a[2] += positions[3 * i + 2];
      a[3]++;
      sum.set(cats[i], a);
    }
    return [...sum.entries()]
      .map(([slot, [x, y, z, n]]) => ({
        key: slots[slot],
        n,
        at: [x / n, y / n, z / n] as [number, number, number],
        label: data.domains.find((d) => d.id === slots[slot])?.label ?? (slots[slot] === MIXED ? "Mixed" : "Not enough text"),
        colour: colourOf(data, { domain: slots[slot], status: slots[slot] === MIXED ? "mixed" : slots[slot] === UNCLEAR ? "insufficient_text" : "clear", prizes: [] } as Parameters<typeof colourOf>[1]) ?? [1, 1, 1],
      }))
      .sort((a, b) => b.n - a.n);
  }, [data, cats, visible, positions, slots]);
  const listMode: ListMode = shown <= LIST_ALL ? "all" : !nearby.zoomed && listClouds.length > 0 ? "clouds" : "near";
  const flyToCloud = useCallback((at: [number, number, number]) => view.flyToCloud(at), [view]);
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

  // The story (Plan 5): one clock for the map (here) and the overlay. Each beat is driven from its start whenever the
  // beat changes or the presenter steps, so a step back or forward always lands on the same picture.
  const story = useMemo(() => new Story(), []);
  const twins = useMemo(() => findTwins(stars), [stars]);
  const [beat, setBeat] = useState<Beat | null>(null);
  const run = useRef({ beat: null as Beat | null, prev: story.state(0), saved: null as Status | null });
  const drive = useCallback(
    (b: Beat, s: StoryState, now: number) => {
      const from = now - (s.t - BEAT_AT[b]); // the beat's start on the wall clock
      const last = twins.at(-1);
      director.halt();
      setState({ selectedProjectId: b === "proof" && last ? last.id : null });
      if (b === "sky") {
        view.fit();
        if (survey) director.startIntro(survey.clouds.map((c) => c.slot), from);
      } else if (b === "egg") director.needsFraming = true; // the scene frames the story's idea and the twins
      else if (b === "twins") {
        // Twin k lands at TWIN_AT[k] (its chime); the arcs reach out from the beat's start.
        const pace = { reachAt: TWIN_AT[0] - BEAT_AT.twins - SCAN.reach, gap: TWIN_AT[1] - TWIN_AT[0] };
        director.startScan(STORY_KEY, twins.map((t) => cats?.[t.index] ?? -1), from, pace);
      } else if (b === "turn") view.fit();
      if (s.paused) director.pause(now);
    },
    [twins, director, view, survey, cats],
  );
  // Presenter state on every start, pause, step and stop; the beat itself moves on with time, read each frame.
  useEffect(() => {
    const sync = (now: number, force: boolean) => {
      const s = story.state(now);
      if (s.beat && (force || s.beat !== run.current.beat)) drive(s.beat, s, now);
      if (s.beat !== run.current.beat) setBeat((run.current.beat = s.beat));
    };
    const off = story.subscribe((s) => {
      const now = performance.now() / 1000;
      const was = run.current.prev;
      run.current.prev = s;
      if (!s.playing) {
        if (!was.playing) return;
        // The end, or Escape: everything as it was before the story, nothing selected, the whole map.
        director.halt(run.current.saved ?? undefined);
        setState({ selectedProjectId: null });
        view.fit();
        setBeat((run.current.beat = null));
        return;
      }
      if (!was.playing) {
        director.skip(now); // a scan or intro already playing ends settled, and that is what the story hands back
        run.current.saved = director.status;
      } else if (was.paused !== s.paused) return void (s.paused ? director.pause(now) : director.resume(now));
      sync(now, true);
    });
    let raf = 0;
    const frame = () => {
      const now = performance.now() / 1000;
      story.tick(now);
      if (story.state(now).playing) {
        view.poke(); // no drift under the story, paused or not
        sync(now, false);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => (off(), cancelAnimationFrame(raf));
  }, [story, drive, director, view]);
  // ponytail: cast because story.ts types `twins` as the literal 3 (its default is TWINS.length, `as const`); drop it
  // once play() declares `twins: number`.
  const playStory = useCallback(() => story.play(performance.now() / 1000, twins.length as 3), [story, twins.length]);
  const storyAsked = useRef(false);
  useEffect(() => {
    if (storyAsked.current || load.state !== "ready" || classes.state === "loading" || !new URLSearchParams(location.search).has("story")) return;
    storyAsked.current = true;
    playStory();
  }, [load.state, classes.state, playStory]);
  // Presenter keys while it plays: Space pauses, the arrows step a beat, Escape ends it. Caught first, so they never
  // also scroll the page, press a focused button or reach another key handler; typing in a field is left alone.
  const storyOn = beat !== null;
  useEffect(() => {
    if (!storyOn) return;
    const keys: Record<string, (now: number) => void> = {
      " ": (now) => story.toggle(now),
      ArrowRight: (now) => story.step(now, 1),
      ArrowLeft: (now) => story.step(now, -1),
      Escape: (now) => story.stop(now),
    };
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const catches = (e: KeyboardEvent) => {
      if (!keys[e.key] || typing(e.target)) return false;
      e.preventDefault();
      e.stopPropagation();
      return true;
    };
    const down = (e: KeyboardEvent) => catches(e) && !e.repeat && keys[e.key](performance.now() / 1000);
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", catches, true);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", catches, true);
    };
  }, [storyOn, story]);
  // A grab of the map pauses the story rather than skipping it.
  const onGrab = useCallback(() => {
    const now = performance.now() / 1000;
    const s = story.state(now);
    if (!s.playing) return false;
    if (!s.paused) story.toggle(now);
    return true;
  }, [story]);
  // The story's idea: never saved, placed among the twins; it appears in the egg beat, reaches them in the twins beat
  // and fades in the turn.
  const storyScene = useMemo((): StoryScene | null => {
    if (!beat) return null;
    if (beat === "sky" || twins.length === 0) return { idea: null, glow: () => 0 };
    const neighbours = twins.map((t) => t.index);
    const own = [0, 1, 2].map((k) => neighbours.reduce((sum, i) => sum + positions[3 * i + k], 0) / neighbours.length) as Vec3;
    const t = () => story.state(performance.now() / 1000).t;
    const clamp = (x: number) => Math.min(1, Math.max(0, x));
    return {
      idea: { neighbours, own, lines: beat === "twins" || beat === "proof" },
      glow: beat === "turn" ? () => clamp(1 - (t() - BEAT_AT.turn) / 1.5) : () => clamp((t() - BEAT_AT.egg) / 0.6),
    };
  }, [beat, twins, positions, story]);

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
      data-plain={plain}
      data-dimmed-count={dimmed}
      data-scan={scanStatus.key === activeIdea && activeIdea ? scanStatus.scan : "idle"}
      data-intro={scanStatus.intro}
      data-story={beat ?? "idle"}
      tabIndex={0}
      aria-label="Star map. Drag to move across it, right-drag or option-drag to turn it, scroll or pinch to zoom where you point; plus, minus and 0 keys zoom in, out and fit."
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
        nearby={listOpen && listMode !== "all" ? onNearby : undefined}
        nearbyHold={nearbyHold}
        story={storyScene}
        onGrab={onGrab}
      />
      {/* The scan's tags: each neighbour's real similarity and title, placed beside its star by the scene. */}
      <div ref={setTagLayer} className={styles.tags} role="group" aria-label="Nearest projects to your idea" onWheel={passWheel}>
        {/* In the story, the twins: title, then event · year (no similarity: the story's idea was never embedded). */}
        {storyOn && twins.map((t) => (
          <button key={t.id} type="button" aria-label={`Select ${t.title}`} onClick={() => setState({ selectedProjectId: t.id })}>
            <span>{shortTitle(t.title)}</span>
            <small>{[t.event, t.year].filter((v) => v != null).join(" · ")}</small>
          </button>
        ))}
        {!storyOn && scanRows.slice(0, 8).map((r) => (
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
          <span key={g.key} className={styles.region} style={{ "--hue": plain ? "var(--paper)" : `rgb(${g.colour.map((c) => Math.round(c * 255)).join(" ")})` } as React.CSSProperties}>
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
        <button type="button" aria-label="Play the story" onClick={playStory}>
          <svg viewBox="0 0 24 24" aria-hidden><path d="M8 5.5v13l10.5-6.5z" /></svg>
        </button>
        <button type="button" aria-label="Show the whole map" onClick={() => view.fit()}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z" />
          </svg>
        </button>
      </div>
      {/* The story shows its own counter in the sky; the survey log would say the same thing twice. */}
      {!storyOn && <Readout
        status={scanStatus}
        // Only once this idea's own scan has started: the frame between a new idea arriving and its scan starting showed
        // the previous scan's "done" over the new neighbours (#458).
        active={Boolean(activeIdea && neighbors && neighbors.length > 0 && scanStatus.key === activeIdea)}
        rows={scanRows}
        searched={scan.state === "ready" ? scan.searched : stars.length}
        sourceUpdated={scan.state === "ready" && scan.neighbors.some((neighbor) => neighbor.corpusVersion !== scan.corpusVersion)}
        similarity={scan.state}
        survey={survey}
        total={stars.length}
        onSelect={(id) => setState({ selectedProjectId: id })}
        onReplay={() => activeIdea && playScan(activeIdea)}
      />}
      <StoryOverlay story={story} total={stars.length} twins={twins} />
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
          <ProjectList
            stars={stars}
            visible={visible}
            selectedId={selectedId}
            data={data}
            mode={listMode}
            near={nearby.ids}
            clouds={listClouds}
            shown={shown}
            onCloud={flyToCloud}
            onOpen={setListOpen}
            onHold={onListHold}
          />
          <button type="button" className={`ui-chip ${styles.plain}`} aria-pressed={plain} onClick={togglePlain}>
            Hide category colors
          </button>
        </div>,
      )}
    </div>
  );
}

// Memoised, so a hover (which re-renders the galaxy) doesn't re-render every row; and its rows exist only while it's
// open, so a collapsed list costs nothing at any corpus size.
const LIST_ALL = 200; // at most this many visible stars are all listed
type ListMode = "all" | "clouds" | "near";
type ListCloud = { key: string; n: number; at: [number, number, number]; label: string; colour: readonly number[] };
type Nearby = { ids: number[]; zoomed: boolean };
const ProjectList = memo(function ProjectList(props: {
  stars: Star[];
  visible: Uint8Array;
  selectedId: string | null;
  data: ClassesFile | null;
  mode: ListMode;
  near: number[];
  clouds: ListCloud[];
  shown: number;
  onCloud: (at: [number, number, number]) => void;
  onOpen: (open: boolean) => void;
  onHold: (held: boolean) => void;
}) {
  const { stars, visible, selectedId, data, mode, near, clouds, shown, onCloud, onOpen, onHold } = props;
  const [open, setOpenState] = useState(false);
  const setOpen = (o: boolean) => (setOpenState(o), onOpen(o));
  const caption = useRef<HTMLParagraphElement>(null);
  const rows = mode === "all" ? stars.flatMap((s, i) => (visible[i] ? [i] : [])) : mode === "near" ? near.filter((i) => visible[i]) : [];
  return (
    <details
      className={styles.list}
      data-list-mode={mode}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      onPointerEnter={() => onHold(true)}
      onPointerLeave={(e) => onHold(e.currentTarget.contains(document.activeElement))}
      onFocus={() => onHold(true)}
      onBlur={(e) => onHold(e.currentTarget.contains(e.relatedTarget as Node | null) || e.currentTarget.matches(":hover"))}
    >
      {/* Click (Enter on a summary is one) renders the rows at once: toggle fires a task later, after a quick Tab. */}
      <summary onClick={(e) => setOpen(!(e.currentTarget.parentElement as HTMLDetailsElement).open)}>Projects ({stars.length.toLocaleString()})</summary>
      {open && mode !== "all" && (
        <p ref={caption} tabIndex={-1} className={styles.listNote}>
          {mode === "clouds"
            ? `${shown.toLocaleString("en-US")} projects. Pick a cloud, zoom in or search to list projects.`
            : rows.length > 0
              ? `${rows.length} nearest the middle of the view, of ${shown.toLocaleString("en-US")}.`
              : "No projects in view. Move the map or search."}
        </p>
      )}
      {open && mode === "clouds" && (
        <ul aria-label="Clouds">
          {clouds.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                className={styles.cloudRow}
                style={{ "--hue": `rgb(${c.colour.map((v) => Math.round(v * 255)).join(" ")})` } as React.CSSProperties}
                onClick={() => {
                  onCloud(c.at);
                  caption.current?.focus(); // the row is about to become that cloud's projects
                }}
              >
                {c.label}
                <span className={styles.meta}>{c.n.toLocaleString("en-US")} projects</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ul aria-label="Projects">
        {open &&
          rows.map((i) => {
            const s = stars[i];
            return (
              <li key={s.id}>
                <button type="button" data-id={s.id} aria-pressed={s.id === selectedId} onClick={() => setState({ selectedProjectId: s.id })}>
                  {s.title}
                  <Meta event={s.event} year={s.year} />
                  <Category data={data} id={s.id} />
                </button>
              </li>
            );
          })}
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
type ScanLoad = { state: "loading" } | { state: "unavailable" } | { state: "ready"; corpusVersion: string; searched: number | null; neighbors: { id: string; similarity: number; corpusVersion: string }[] };
async function scanOf(versionId: string): Promise<ScanLoad> {
  if (!(await initWorkspace()).ok) return { state: "unavailable" };
  try {
    const r = await fetch(`/api/scan/${versionId}`);
    if (!r.ok) return { state: "unavailable" };
    const body = (await r.json()) as { corpusVersion: string; searched: number | null; neighbors: { id: string; similarity: number; corpusVersion: string }[] };
    return { state: "ready", corpusVersion: body.corpusVersion, searched: body.searched, neighbors: body.neighbors };
  } catch {
    return { state: "unavailable" };
  }
}

const setParam = (key: string, value: string | null) => {
  const url = new URL(location.href);
  if (value === null) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  window.history.replaceState(window.history.state, "", url);
};

const portal = (target: HTMLElement | null, node: React.ReactNode) => (target ? createPortal(node, target) : node);
