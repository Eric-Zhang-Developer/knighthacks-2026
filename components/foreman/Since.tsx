"use client";

import { useEffect, useState } from "react";
import type { Board } from "@/lib/foreman/board";
import { clock } from "@/lib/foreman/time";
import styles from "./foreman.module.css";

const KEY = "foreman:last-seen";
const MIN_GAP = 5 * 60_000; // a reload a minute later isn't "since you last looked"

// Per-browser: when this viewer last opened the board. Storage can be missing or blocked; then nothing shows.
function readSeen(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export default function Since({ replay, features, now }: Pick<Board, "replay" | "features"> & { now: number }) {
  const [seen, setSeen] = useState<number | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const prev = readSeen();
    setSeen(prev !== null && now - prev >= MIN_GAP ? prev : null);
    try {
      if (prev === null || now - prev >= MIN_GAP) localStorage.setItem(KEY, String(now));
    } catch {}
    // Only on first mount. `now` is the snapshot time, so a reload of the same snapshot shows nothing new.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (seen === null || hidden) return null;
  const merged = replay.filter((r) => Date.parse(r.at) > seen);
  const built = features.filter((f) => f.doneAt && Date.parse(f.doneAt) > seen).map((f) => f.slug);

  return (
    <aside className={styles.since} aria-label="Since you last looked">
      <span className={styles.sinceHead}>
        Since you last looked · the snapshot of {clock(seen)}
      </span>
      {merged.length === 0 ? (
        <span>nothing merged.</span>
      ) : (
        <span>
          <b>{merged.length}</b> PRs merged
          {built.length > 0 && (
            <>
              {" "}
              · newly built: <b>{built.join(", ")}</b>
            </>
          )}
        </span>
      )}
      <button type="button" className={styles.sinceClose} onClick={() => setHidden(true)} aria-label="Dismiss">
        ×
      </button>
    </aside>
  );
}
