"use client";

import { useCallback, useEffect, useState } from "react";
import type { Version } from "@/components/revisions/trail";
import { PanelState } from "@/components/ui";
import { initWorkspace, post } from "@/components/workspace/api";
import { getState, setState, useAppState } from "@/lib/store";
import { addStars, branchVersions, generations, type Direction } from "./tree";
import styles from "./branches.module.css";

const FIELDS = ["title", "description", "audience", "problem", "workflow", "constraints"] as const;
type Field = (typeof FIELDS)[number];

async function get<T>(path: string): Promise<T | null> {
  if (!(await initWorkspace()).ok) return null;
  const res = await fetch(path).catch(() => null);
  return res?.ok ? ((await res.json()) as T) : null;
}

// The idea that contains a version: each idea's latest version first, then its trail.
async function trailFor(versionId: string): Promise<Version[] | null> {
  for (const latest of (await get<Version[]>("/api/ideas")) ?? []) {
    const trail = await get<Version[]>(`/api/revisions/trail/${latest.ideaId}`);
    if (trail?.some((v) => v.versionId === versionId)) return trail;
  }
  return null;
}

const select = (v: Version) => setState({ activeIdeaVersionId: v.versionId, highlightedIds: v.neighborIds });

export default function Branches() {
  const active = useAppState((s) => s.activeIdeaVersionId);
  const stars = useAppState((s) => s.ideaStars);
  const [trail, setTrail] = useState<Version[]>([]);
  const [directions, setDirections] = useState<Direction[] | null>(null);
  const [source, setSource] = useState<string | null>(null); // the version the directions branch from
  const [manual, setManual] = useState<{ field: Field; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (versionId: string) => {
    const t = await trailFor(versionId);
    if (!t) return;
    setTrail(t);
    setState({ ideaStars: addStars(getState().ideaStars, branchVersions(t)) });
  }, []);

  useEffect(() => {
    if (active) load(active);
  }, [active, load]);

  if (!active || trail.length === 0) return null;
  const from = source ?? active;

  async function run<T>(label: string, path: string, body?: unknown) {
    setBusy(label);
    setError(null);
    const r = await post<T>(path, body);
    setBusy(null);
    if (!r.ok) setError(r.error);
    return r.ok ? r.data : null;
  }

  async function suggest() {
    const r = await run<{ directions: Direction[] }>("suggest", "/api/branches/suggest", { versionId: active });
    if (r) {
      setSource(active);
      setDirections(r.directions);
    }
  }

  // A new branch gets its own star beside the others; the current version stays selected.
  function added(v: Version) {
    setTrail((t) => [...t, v]);
    setState({ ideaStars: addStars(getState().ideaStars, [v]) });
  }

  async function accept(d: Direction) {
    const v = await run<Version>(d.id, `/api/branches/${d.id}/accept`);
    if (!v) return;
    added(v);
    setDirections((list) => list?.filter((x) => x.id !== d.id) ?? null);
  }

  async function branchManually() {
    if (!manual?.text.trim()) return;
    const v = await run<Version>("manual", "/api/branches/manual", { versionId: from, fields: { [manual.field]: manual.text.trim() } });
    if (!v) return;
    added(v);
    setManual(null);
  }

  const rows = generations(trail);
  const branches = branchVersions(trail);
  const number = new Map(trail.map((v, i) => [v.versionId, i + 1]));
  const shown = trail.find((v) => v.versionId === active);

  return (
    <section
      className={`ui-panel ${styles.panel}`}
      aria-label="Branches"
      data-branch-count={branches.length}
      data-branch-stars={branches.filter((b) => stars.some((s) => s.versionId === b.versionId)).length}
    >
      <h2 className="ui-heading">Branch this idea</h2>

      <div className={styles.tree} aria-label="Branch trail">
        {rows.map((row, i) => (
          <div key={i} className={styles.generation}>
            {row.map((v) => (
              <button key={v.versionId} type="button" aria-pressed={v.versionId === active} onClick={() => select(v)}>
                {v.title ?? "Untitled"} <span className={styles.meta}>v{number.get(v.versionId)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {shown && (
        <dl className={styles.details} aria-label="Selected branch" data-version-id={shown.versionId}>
          {FIELDS.map((f) => (
            <div key={f}>
              <dt>{f}</dt>
              <dd>{shown[f] ?? <span className={styles.unknown}>not stated</span>}</dd>
            </div>
          ))}
        </dl>
      )}

      {directions === null ? (
        <div className={styles.row}>
          <button type="button" className={styles.primary} disabled={busy !== null} onClick={suggest}>
            {busy === "suggest" ? "Finding directions…" : "Suggest directions"}
          </button>
          {!manual && (
            <button type="button" disabled={busy !== null} onClick={() => setManual({ field: "workflow", text: "" })}>
              Branch manually
            </button>
          )}
        </div>
      ) : directions.length === 0 ? (
        <div className={styles.row}>
          <PanelState kind="empty" message="No directions left." />
          <button type="button" onClick={() => setDirections(null)}>
            Done
          </button>
        </div>
      ) : (
        <ul className={styles.directions} aria-label="Directions">
          {directions.map((d) => (
            <li key={d.id}>
              <p>
                <strong>{d.title}</strong>
              </p>
              <p className={styles.meta}>{d.change}</p>
              <button type="button" className={styles.primary} disabled={busy !== null} onClick={() => accept(d)}>
                Branch this way
              </button>
            </li>
          ))}
        </ul>
      )}

      {manual && (
        <form
          className={styles.manual}
          onSubmit={(e) => {
            e.preventDefault();
            branchManually();
          }}
        >
          <label className={styles.row}>
            <span className={styles.meta}>Change</span>
            <select value={manual.field} onChange={(e) => setManual({ ...manual, field: e.target.value as Field })}>
              {FIELDS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <textarea
            aria-label="New text"
            rows={2}
            value={manual.text}
            onChange={(e) => setManual({ ...manual, text: e.target.value })}
          />
          <div className={styles.row}>
            <button type="submit" className={styles.primary} disabled={busy !== null || !manual.text.trim()}>
              Create branch
            </button>
            <button type="button" onClick={() => setManual(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && <PanelState kind="failed" message={error} />}
    </section>
  );
}
