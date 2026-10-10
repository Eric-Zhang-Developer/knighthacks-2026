"use client";

import { useEffect, useState } from "react";
import { ClaimBadge, PanelState, type ClaimLabel } from "@/components/ui";
import { initWorkspace } from "@/components/workspace/api";
import styles from "./evidence.module.css";

// Shape pinned by strongest-alternative-api (lib/alternative/contract.ts).
type Point = { step: string; claim: { text: string; label: ClaimLabel; sourceIds: string[] } };
type Alternative = { projectId: string; url: string; title: string; points: Point[]; missingWorkflow: boolean };
type View = { kind: "loading" } | { kind: "failed"; error: string } | { kind: "ready"; alternative: Alternative };

// POST returns the stored comparison without regenerating, so it also serves a reload.
async function fetchAlternative(versionId: string): Promise<View> {
  if (!(await initWorkspace()).ok) return { kind: "failed", error: "No workspace" };
  try {
    const res = await fetch(`/api/alternative/${versionId}`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { kind: "ready", alternative: json as Alternative } : { kind: "failed", error: (json as { error?: string }).error ?? `HTTP ${res.status}` };
  } catch {
    return { kind: "failed", error: "Network error" };
  }
}

function PointItem({ point }: { point: Point }) {
  return (
    <li className={styles.point}>
      <span className={styles.step}>Step: {point.step}</span>
      <span>
        <ClaimBadge label={point.claim.label} /> {point.claim.text}
      </span>
    </li>
  );
}

export default function StrongestAlternative({ versionId }: { versionId: string }) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true; // a newer version replaces this request's result
    setView({ kind: "loading" });
    fetchAlternative(versionId).then((v) => current && setView(v));
    return () => {
      current = false;
    };
  }, [versionId, attempt]);

  return (
    <section className={`ui-panel ${styles.evidence}`} aria-label="Strongest alternative">
      <h2 className="ui-heading">Strongest existing alternative</h2>
      {view.kind === "loading" && <PanelState kind="loading" message="Checking whether something like this already exists…" />}
      {view.kind === "failed" && (
        <PanelState kind="failed" message={`Couldn't compare with the closest project: ${view.error}`} onRetry={() => setAttempt((n) => n + 1)} />
      )}
      {view.kind === "ready" && (
        <>
          <p className={styles.title}>
            {view.alternative.title}{" "}
            <a className={styles.source} href={view.alternative.url} target="_blank" rel="noopener noreferrer">
              Source ↗
            </a>
          </p>
          {view.alternative.missingWorkflow ? (
            <p className={styles.prompt}>
              Your idea has no workflow yet. Add how someone uses it, step by step (Suggest revisions can propose one), to
              check whether {view.alternative.title} already lets them do it.
            </p>
          ) : (
            <>
              <ul className={styles.claims} aria-label="Points">
                {view.alternative.points.slice(0, 1).map((p, i) => (
                  <PointItem key={i} point={p} />
                ))}
              </ul>
              {view.alternative.points.length > 1 && (
                <details className={styles.details}>
                  <summary>
                    {view.alternative.points.length - 1} more point{view.alternative.points.length > 2 ? "s" : ""}
                  </summary>
                  <ul className={styles.claims}>
                    {view.alternative.points.slice(1).map((p, i) => (
                      <PointItem key={i} point={p} />
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
