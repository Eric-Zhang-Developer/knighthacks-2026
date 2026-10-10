"use client";

import { useEffect, useMemo, useState } from "react";
import { statesAt, type Board } from "@/lib/foreman/board";
import { atWork, type Chapter, type Timeline } from "@/lib/foreman/charts";
import Graph from "./Graph";
import { advance, clock, CRUISE_MS, span } from "@/lib/foreman/time";
import styles from "./foreman.module.css";

const BUCKET = 30 * 60_000; // histogram bucket
const FLASH_MS = 900; // a node that lands flashes for this long of playback

type Props = Pick<Board, "features" | "replay" | "repo" | "start"> & { now: number; crew: Timeline | null; chapters: Chapter[] };

// The judge tour (spec § The tour): the feature graph, a scrubber that replays it from the first PR to the snapshot
// (`now` is the snapshot time), counters and a ticker for the scrubbed moment, and chapters from the snapshot.
export default function SitePlan({ features, replay, repo, start, now, crew, chapters }: Props) {
  // From the first PR activity, not the event start: nothing on GitHub happened before it, so playing it is dead air.
  const first = Math.min(
    ...features.flatMap((f) => f.claims.map(([a]) => Date.parse(a))),
    ...replay.map((r) => Date.parse(r.at)),
    now,
  );
  const [t, setT] = useState<number | null>(null); // null = the snapshot
  const [playing, setPlaying] = useState(false);

  // One step per display frame, eased up from wherever the playhead is now (spec § The tour, Motion).
  useEffect(() => {
    if (!playing) return;
    const base = (now - first) / CRUISE_MS;
    const started = performance.now();
    let last = started;
    let raf = requestAnimationFrame(function tick(ts) {
      const dt = Math.min(64, ts - last); // a background tab's long gap doesn't leap the build forward
      last = ts;
      setT((x) => {
        const next = advance(x ?? first, now, base, ts - started, dt);
        if (next < now) return next;
        setPlaying(false);
        return null;
      });
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [playing, first, now]);

  const toggle = () => {
    if (!playing && t === null) setT(first);
    setPlaying(!playing);
  };
  // Space in demo mode (DemoKeys) toggles the same way as the button.
  useEffect(() => {
    window.addEventListener("foreman:replay", toggle);
    return () => window.removeEventListener("foreman:replay", toggle);
  });

  const shown = useMemo(() => (t === null ? undefined : statesAt(features, t)), [features, t]);
  const at = t ?? now;
  const merged = replay.filter((r) => Date.parse(r.at) <= at);
  const scheduled = features.filter((f) => f.milestone);
  const built = scheduled.filter((f) => (shown?.get(f.slug) ?? f.state) === "done").length;
  const working = crew ? atWork(crew, at) : null;
  const latest = merged.slice(-3).reverse();
  const caption = t === null ? null : chapters.filter((c) => c.t <= at).at(-1);
  const full = Math.max(1, now - first);
  // Features whose merge the playhead just passed: about FLASH_MS of playback, whatever the build's length.
  const flash = useMemo(() => {
    if (t === null) return undefined;
    const win = (full / CRUISE_MS) * FLASH_MS;
    return new Set(features.filter((f) => f.doneAt && Date.parse(f.doneAt) <= t && Date.parse(f.doneAt) > t - win).map((f) => f.slug));
  }, [features, t, full]);

  const buckets = useMemo(() => {
    const n = Math.max(1, Math.ceil((now - first) / BUCKET));
    const out = Array.from({ length: n }, () => ({ feature: 0, other: 0 }));
    for (const r of replay) {
      const i = Math.min(n - 1, Math.floor((Date.parse(r.at) - first) / BUCKET));
      if (i >= 0) out[i][r.kind === "feature" ? "feature" : "other"]++;
    }
    return out;
  }, [replay, first, now]);
  const peak = Math.max(1, ...buckets.map((b) => b.feature + b.other));

  return (
    <>
      {replay.length > 0 && (
        <div className={styles.tourHead}>
          <div className={styles.counters} data-testid="tour-counters">
            <Counter n={`${built}/${scheduled.length}`} label="features built" />
            <Counter n={merged.length} label="PRs merged" />
            <Counter n={working ?? "—"} label="agents at work" />
          </div>
          <p className={styles.caption} data-testid="tour-caption" aria-live="polite">
            {caption ? (
              <span key={caption.label} className={styles.captionText} data-testid="chapter-caption">
                {caption.label}
              </span>
            ) : (
              t === null && <span className={styles.invite}>press space to watch it get built</span>
            )}
          </p>
        </div>
      )}
      {replay.length === 0 ? (
        <p className={styles.needsPrs}>The replay needs PR data, missing from this snapshot (see above).</p>
      ) : (
      <div className={styles.replay} aria-label="Replay the build">
        <button
          type="button"
          className={styles.play}
          onClick={toggle}
          aria-pressed={playing}
        >
          {playing ? "❚❚ pause" : t === null ? "▶ replay the build" : "▶ resume"}
        </button>
        <div className={styles.track}>
          <svg className={styles.hist} viewBox={`0 0 ${buckets.length} ${peak}`} preserveAspectRatio="none" aria-hidden>
            {buckets.map((b, i) => (
              <g key={i}>
                <rect x={i + 0.12} y={peak - b.feature - b.other} width={0.76} height={b.other} fill="#ffb547" opacity={0.75} />
                <rect x={i + 0.12} y={peak - b.feature} width={0.76} height={b.feature} fill="#8fef9a" />
              </g>
            ))}
            <rect x={0} y={0} width={((at - first) / full) * buckets.length} height={peak} fill="#ffb547" opacity={0.08} />
          </svg>
          {chapters
            .filter((c) => c.t >= first && c.t <= now)
            .map((c) => (
              <span
                key={c.label}
                className={`${styles.tick} ${c.t <= at && t !== null ? styles.tickPassed : ""}`}
                style={{ left: `${((c.t - first) / full) * 100}%` }}
                title={`${clock(c.t)} · ${c.label}`}
                data-testid="chapter"
              />
            ))}
          <input
            type="range"
            className={styles.range}
            min={first}
            max={now}
            step={60_000}
            value={at}
            aria-label="Time"
            aria-valuetext={clock(at)}
            onChange={(e) => {
              setPlaying(false);
              const v = Number(e.target.value);
              setT(v >= now - 60_000 ? null : v);
            }}
          />
        </div>
        <div className={styles.replayInfo} data-testid="replay-info">
          <span className={styles.replayClock}>
            {t === null ? "SNAPSHOT" : clock(t)}
            {start !== null && <small> T{at >= start ? "+" : "−"}{span(at - start).slice(0, 5)}</small>}
          </span>
          <ol className={styles.ticker} aria-label="Latest merges">
            {latest.length ? (
              latest.map((r) => (
                <li key={r.number}>
                  <b>#{r.number}</b> {r.title}
                </li>
              ))
            ) : (
              <li>no merges yet</li>
            )}
          </ol>
        </div>
        {t !== null && (
          <button type="button" className={styles.liveBtn} onClick={() => (setPlaying(false), setT(null))}>
            back to snapshot
          </button>
        )}
      </div>
      )}
      <Graph features={features} repo={repo} shown={shown} flash={flash} />
    </>
  );
}

function Counter({ n, label }: { n: string | number; label: string }) {
  return (
    <div className={styles.counter}>
      {/* keyed by value: each change remounts it, which replays the bump */}
      <b key={n} className={`${styles.stencil} ${styles.bump}`}>
        {n}
      </b>
      <span>{label}</span>
    </div>
  );
}
