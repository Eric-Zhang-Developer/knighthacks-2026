"use client";

import { useEffect, useMemo, useState } from "react";
import { statesAt, type Board } from "@/lib/foreman/board";
import Graph from "./Graph";
import { clock, span } from "@/lib/foreman/time";
import styles from "./foreman.module.css";

const PLAY_MS = 24_000; // the whole build replays in this long
const BUCKET = 30 * 60_000; // histogram bucket

type Props = Pick<Board, "features" | "replay" | "repo" | "start" | "heatBasis"> & { now: number };

// The feature graph, plus a scrubber that replays it from the first PR to now.
export default function SitePlan({ features, replay, repo, start, heatBasis, now }: Props) {
  // From the first PR activity, not the event start: nothing on GitHub happened before it, so playing it is dead air.
  const first = Math.min(
    ...features.flatMap((f) => f.claims.map(([a]) => Date.parse(a))),
    ...replay.map((r) => Date.parse(r.at)),
    now,
  );
  const [t, setT] = useState<number | null>(null); // null = live
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const step = ((now - first) / PLAY_MS) * 50;
    const id = setInterval(
      () =>
        setT((x) => {
          const next = (x ?? first) + step;
          if (next < now) return next;
          setPlaying(false);
          return null;
        }),
      50,
    );
    return () => clearInterval(id);
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
  const flight = features.filter((f) => (shown?.get(f.slug) ?? f.state) === "flight").length;

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
      <Graph features={features} repo={repo} shown={shown} heatBasis={heatBasis} />
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
            <rect x={0} y={0} width={((at - first) / Math.max(1, now - first)) * buckets.length} height={peak} fill="#ffb547" opacity={0.08} />
          </svg>
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
            {t === null ? "LIVE" : clock(t)}
            {start !== null && <small> T{at >= start ? "+" : "−"}{span(at - start).slice(0, 5)}</small>}
          </span>
          <span>
            <b>{built}</b>/{scheduled.length} built · <b>{flight}</b> in flight · <b>{merged.length}</b> PRs merged
          </span>
          <span className={styles.replayLast}>{merged.at(-1) ? `last: #${merged.at(-1)!.number} ${merged.at(-1)!.title}` : "no merges yet"}</span>
        </div>
        {t !== null && (
          <button type="button" className={styles.liveBtn} onClick={() => (setPlaying(false), setT(null))}>
            back to live
          </button>
        )}
      </div>
    </>
  );
}
