"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { setState, useAppState } from "@/lib/store";
import type { Hover } from "./Scene";
import { parseStars, type StarsFile } from "./stars";
import styles from "./galaxy.module.css";

// WebGL only exists in the browser.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

type Load = { state: "loading" } | { state: "missing"; reason?: string } | { state: "ready"; data: StarsFile };

export default function Galaxy() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [hover, setHover] = useState<Hover>(null);
  const selectedId = useAppState((s) => s.selectedProjectId);

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

  const stars = useMemo(() => (load.state === "ready" ? load.data.stars : []), [load]);
  const ids = useMemo(() => stars.map((s) => s.id), [stars]);
  const positions = useMemo(() => new Float32Array(stars.flatMap((s) => [s.x, s.y, s.z])), [stars]);
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
    <div className={styles.galaxy} data-star-count={positions.length / 3} data-selected-id={selectedId ?? ""}>
      <Scene ids={ids} positions={positions} onHover={setHover} onPick={onPick} />
      <p role="status" className={styles.status}>
        {stars.length} projects indexed
      </p>
      {hover && hovered && (
        <div role="tooltip" className={styles.tooltip} style={{ left: hover.x + 12, top: hover.y + 12 }}>
          <strong>{hovered.title}</strong>
          <Meta event={hovered.event} year={hovered.year} />
        </div>
      )}
      <details className={styles.list}>
        <summary>Projects ({stars.length})</summary>
        <ul aria-label="Projects">
          {stars.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={s.id === selectedId}
                onClick={() => setState({ selectedProjectId: s.id })}
              >
                {s.title}
                <Meta event={s.event} year={s.year} />
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

// Unknown event or year stays visibly empty rather than guessed.
function Meta({ event, year }: { event?: string | null; year?: number | null }) {
  return (
    <span className={styles.meta}>
      {event ?? "event unknown"} · {year ?? "year unknown"}
    </span>
  );
}
