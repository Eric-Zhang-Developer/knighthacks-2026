"use client";

import { useCallback, useEffect, useState } from "react";
import type { Version } from "@/components/revisions/trail";
import { ClaimBadge, PanelState } from "@/components/ui";
import { initWorkspace, post } from "@/components/workspace/api";
import { useAppState } from "@/lib/store";
import { cell, columns, MIN, toggle, type Comparison } from "./table";
import styles from "./compare.module.css";

async function get<T>(path: string): Promise<T | null> {
  if (!(await initWorkspace()).ok) return null;
  const res = await fetch(path).catch(() => null);
  return res?.ok ? ((await res.json()) as T) : null;
}

// The trail of whichever idea contains this version.
async function trailFor(versionId: string): Promise<Version[] | null> {
  for (const latest of (await get<Version[]>("/api/ideas")) ?? []) {
    const trail = await get<Version[]>(`/api/revisions/trail/${latest.ideaId}`);
    if (trail?.some((v) => v.versionId === versionId)) return trail;
  }
  return null;
}

export default function Compare() {
  const active = useAppState((s) => s.activeIdeaVersionId);
  const [trail, setTrail] = useState<Version[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<{ ids: string[]; data: Comparison } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (versionId: string) => {
    const t = await trailFor(versionId);
    if (t) setTrail(t);
  }, []);
  useEffect(() => {
    if (active) load(active);
  }, [active, load]);

  // Comparing needs at least two versions of the same idea.
  if (!active || trail.length < MIN) return null;

  async function compare() {
    setBusy(true);
    setError(null);
    const ids = [...selected];
    const r = await post<Comparison>("/api/compare", { versionIds: ids });
    setBusy(false);
    if (!r.ok) return setError(`Couldn't compare: ${r.error}`);
    setResult({ ids, data: r.data });
  }

  const cols = result ? columns(trail, result.ids) : [];
  return (
    <section className={`ui-panel ${styles.panel}`} aria-label="Compare versions">
      <h2 className="ui-heading">Compare versions</h2>
      <fieldset className={styles.pick}>
        <legend className={styles.meta}>Pick two or three</legend>
        {trail.map((v, i) => (
          <label key={v.versionId} className={styles.option}>
            <input
              type="checkbox"
              checked={selected.includes(v.versionId)}
              disabled={!selected.includes(v.versionId) && selected.length >= 3}
              onChange={() => setSelected((s) => toggle(s, v.versionId))}
            />
            Version {i + 1}
            <span className={styles.meta}>{v.title ?? "Untitled"}</span>
          </label>
        ))}
      </fieldset>
      <button type="button" className={styles.primary} disabled={busy || selected.length < MIN} onClick={compare}>
        {busy ? "Comparing…" : "Compare"}
      </button>
      {busy && <PanelState kind="loading" message="Comparing on the judging criteria…" />}
      {error && <PanelState kind="failed" message={error} />}

      {result && (
        <div className={styles.scroll}>
          {/* Reasons and uncertainty only: no scores, bars or totals (specs/mission.md). */}
          <table className={styles.table} aria-label="Comparison">
            <thead>
              <tr>
                <th scope="col">Criterion</th>
                {cols.map((c) => (
                  <th key={c.version.versionId} scope="col">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.data.criteria.map((criterion) => (
                <tr key={criterion.name}>
                  <th scope="row">{criterion.name}</th>
                  {cols.map((c) => {
                    const entry = cell(criterion, c.version.versionId);
                    return (
                      <td key={c.version.versionId}>
                        {entry ? (
                          <>
                            <p>
                              <ClaimBadge label={entry.reason.label} /> {entry.reason.text}
                            </p>
                            <p className={styles.uncertain}>Uncertain: {entry.uncertainty}</p>
                          </>
                        ) : (
                          <span className={styles.meta}>No reason given</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
