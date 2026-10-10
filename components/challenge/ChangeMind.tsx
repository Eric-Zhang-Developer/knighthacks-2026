"use client";

import { useCallback, useEffect, useState } from "react";
import { ClaimBadge, PanelState } from "@/components/ui";
import { byKind, kindText, type Assumption } from "./change-mind";
import styles from "./challenge.module.css";

type Load =
  | { state: "loading" }
  | { state: "none" } // nothing listed for this version yet
  | { state: "listing" }
  | { state: "ready"; items: Assumption[] }
  | { state: "failed"; message: string };

// "What would change your mind?": the assumptions the active version rests on, each with what would reverse it.
// Listing them is one model call per version, so it runs when asked; a stored list loads on its own.
// onLoaded hands the same list to the assumption map, so it never fetches it twice.
export default function ChangeMind({ versionId, onLoaded }: { versionId: string; onLoaded?: (items: Assumption[]) => void }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });

  const fetchList = useCallback(async (method: "GET" | "POST") => {
    setLoad({ state: method === "GET" ? "loading" : "listing" });
    try {
      const res = await fetch(`/api/assumptions/${encodeURIComponent(versionId)}`, { method });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        onLoaded?.(json.assumptions as Assumption[]);
        return setLoad({ state: "ready", items: json.assumptions as Assumption[] });
      }
      if (method === "GET" && res.status === 404) return setLoad({ state: "none" });
      setLoad({ state: "failed", message: json.error ?? `HTTP ${res.status}` });
    } catch {
      setLoad({ state: "failed", message: "Network error" });
    }
  }, [versionId, onLoaded]);

  useEffect(() => {
    fetchList("GET");
  }, [fetchList]);

  return (
    <section aria-label="What would change your mind?" className={styles.experiments}>
      <h3 className={styles.subheading}>What would change your mind?</h3>
      {load.state === "loading" && <PanelState kind="loading" message="Loading assumptions…" />}
      {load.state === "none" && (
        <button type="button" className={styles.primary} onClick={() => fetchList("POST")}>
          List my assumptions
        </button>
      )}
      {load.state === "listing" && <PanelState kind="loading" message="Finding what your idea rests on…" />}
      {load.state === "failed" && <PanelState kind="failed" message={`Couldn't list assumptions: ${load.message}`} onRetry={() => fetchList("POST")} />}
      {load.state === "ready" &&
        byKind(load.items).map(([kind, items]) => (
          <div key={kind} className={styles.kindGroup}>
            <p className={styles.label}>{kindText(kind)}</p>
            <ul className={styles.experimentList} aria-label={kindText(kind)}>
              {items.map((a, i) => (
                <li key={i} className={styles.experiment} data-insufficient={a.insufficient}>
                  <p className={styles.source}>
                    <ClaimBadge label={a.assumption.label} /> {a.assumption.text}
                  </p>
                  {a.reversal ? (
                    <>
                      <p>
                        <span className={styles.label}>Check:</span> {a.reversal.observe}
                      </p>
                      <p>
                        <span className={styles.label}>Changes my mind if:</span> {a.reversal.reversesIf}
                      </p>
                    </>
                  ) : (
                    <p className={styles.insufficient}>Evidence is insufficient: nothing concrete would test this yet.</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </section>
  );
}
