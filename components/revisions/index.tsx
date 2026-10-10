"use client";

import { useCallback, useEffect, useState } from "react";
import { PanelState } from "@/components/ui";
import { initWorkspace, post } from "@/components/workspace/api";
import { getState, setState, useAppState } from "@/lib/store";
import { lerpStar, replaceStar, versionNumber, type Suggestion, type Version } from "./trail";
import styles from "./revisions.module.css";

const FIELDS = ["title", "description", "audience", "problem", "workflow", "constraints"] as const;
const MOVE_MS = 600;

async function get<T>(path: string): Promise<T | null> {
  if (!(await initWorkspace()).ok) return null;
  const res = await fetch(path).catch(() => null);
  return res?.ok ? ((await res.json()) as T) : null;
}

// Moves the revised idea's star to its new position; reduced motion jumps there.
function moveStar(from: Version, to: Version) {
  const target = { versionId: to.versionId, x: to.x, y: to.y, z: to.z };
  const place = (star: typeof target) => setState({ ideaStars: replaceStar(getState().ideaStars, [from.versionId, to.versionId], star) });
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return place(target);
  const start = performance.now();
  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / MOVE_MS);
    place(lerpStar(from, target, t));
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

export default function Revisions() {
  const active = useAppState((s) => s.activeIdeaVersionId);
  const [trail, setTrail] = useState<Version[]>([]);
  const [viewing, setViewing] = useState<string | null>(null); // a past version shown without changing the current one
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const loadTrail = useCallback(async (versionId: string) => {
    const ideas = await get<Version[]>("/api/ideas");
    const idea = ideas?.find((v) => v.versionId === versionId);
    const chain = idea ? await get<Version[]>(`/api/revisions/trail/${idea.ideaId}`) : null;
    if (chain) setTrail(chain);
  }, []);

  useEffect(() => {
    setSuggestions(null);
    setViewing(null);
    if (active) loadTrail(active);
    else setTrail([]);
  }, [active, loadTrail]);

  if (!active || trail.length === 0) return null;
  const current = trail.find((v) => v.versionId === active) ?? trail[trail.length - 1];
  const shown = trail.find((v) => v.versionId === viewing) ?? current;

  async function propose() {
    setError(null);
    setNote(null);
    setBusy("propose");
    const r = await post<{ suggestions: Suggestion[] }>("/api/revisions/propose", { versionId: current.versionId });
    setBusy(null);
    if (!r.ok) return setError(`Couldn't get suggestions: ${r.error}`);
    setSuggestions(r.data.suggestions);
  }

  async function reject(s: Suggestion) {
    setBusy(s.id);
    const r = await post<{ rejected: true }>(`/api/revisions/${s.id}/reject`);
    setBusy(null);
    if (!r.ok) return setError(`Couldn't reject: ${r.error}`);
    setSuggestions((list) => list?.filter((x) => x.id !== s.id) ?? null);
  }

  async function accept(s: Suggestion) {
    setBusy(s.id);
    const r = await post<Version>(`/api/revisions/${s.id}/accept`);
    setBusy(null);
    if (!r.ok) return setError(`Couldn't accept: ${r.error}`);
    const next = r.data;
    setTrail((t) => [...t, next]);
    setSuggestions(null);
    setNote("Other suggestions were for the previous version. Ask again for new ones.");
    moveStar(current, next);
    setState({ activeIdeaVersionId: next.versionId, highlightedIds: next.neighborIds });
  }

  return (
    <section
      className={`ui-panel ${styles.panel}`}
      aria-label="Revisions"
      data-current-version={current.versionId}
      data-trail-length={trail.length}
    >
      <h2 className="ui-heading">Refine your idea</h2>

      <ol className={styles.trail} aria-label="Revision trail">
        {trail.map((v, i) => (
          <li key={v.versionId}>
            <button
              type="button"
              aria-pressed={v.versionId === shown.versionId}
              onClick={() => setViewing(v.versionId === current.versionId ? null : v.versionId)}
            >
              Version {i + 1}
              {v.versionId === current.versionId && <span className={styles.meta}> · current</span>}
            </button>
          </li>
        ))}
      </ol>

      <div className={styles.version} aria-label="Shown version" data-version-id={shown.versionId}>
        {shown !== current && (
          <p className={styles.meta}>
            Viewing version {versionNumber(trail, shown.versionId)}. The current version is still {versionNumber(trail, current.versionId)}.
          </p>
        )}
        <dl className={styles.fields}>
          {FIELDS.map((f) => (
            <div key={f}>
              <dt>{f}</dt>
              <dd>{shown[f] ?? <span className={styles.unknown}>not stated</span>}</dd>
            </div>
          ))}
        </dl>
      </div>

      {suggestions === null ? (
        <button type="button" className={styles.primary} disabled={busy !== null} onClick={propose}>
          {busy === "propose" ? "Asking…" : "Suggest revisions"}
        </button>
      ) : suggestions.length === 0 ? (
        <PanelState kind="empty" message="No suggestions left for this version." />
      ) : (
        <ul className={styles.suggestions} aria-label="Suggestions">
          {suggestions.map((s) => (
            <li key={s.id} className={styles.suggestion}>
              <p>
                <strong>{s.field}:</strong> {s.change}
              </p>
              <p className={styles.meta}>{s.reason}</p>
              <div className={styles.actions}>
                <button type="button" className={styles.primary} disabled={busy !== null} onClick={() => accept(s)}>
                  Accept
                </button>
                <button type="button" disabled={busy !== null} onClick={() => reject(s)}>
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {busy === "propose" && <PanelState kind="loading" message="Asking for suggestions…" />}
      {note && <p className={styles.meta}>{note}</p>}
      {error && <PanelState kind="failed" message={error} />}
    </section>
  );
}
