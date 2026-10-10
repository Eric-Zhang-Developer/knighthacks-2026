"use client";

import { useCallback, useEffect, useState } from "react";
import { ClaimBadge, PanelState } from "@/components/ui";
import { changedParts, RESULTS, resultText, type Draft, type Experiment, type Result } from "./experiment";
import styles from "./challenge.module.css";

type Send = { ok: true; data: Experiment } | { ok: false; error: string };

async function send(method: "POST" | "PATCH", path: string, body: unknown): Promise<Send> {
  try {
    const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: json as Experiment } : { ok: false, error: json.error ?? `HTTP ${res.status}` };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

// The version's experiments from the server, so they outlive the page's challenge session.
export function useExperiments(versionId: string | null) {
  const [items, setItems] = useState<Experiment[]>([]);
  const [failed, setFailed] = useState(false);
  const reload = useCallback(async () => {
    if (!versionId) return setItems([]);
    try {
      const res = await fetch(`/api/experiments?versionId=${encodeURIComponent(versionId)}`);
      if (!res.ok) throw new Error();
      setItems((await res.json()) as Experiment[]);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [versionId]);
  useEffect(() => {
    reload();
  }, [reload]);
  const start = async (sessionId: string, round: number) => {
    const r = await send("POST", "/api/experiments", { sessionId, round });
    if (r.ok) await reload();
    return r;
  };
  return { items, failed, reload, start };
}

export function ExperimentList({ items, failed, onChange }: { items: Experiment[]; failed: boolean; onChange: () => void }) {
  if (failed) return <PanelState kind="failed" message="Couldn't load this version's experiments." onRetry={onChange} />;
  if (!items.length) return null;
  return (
    <section aria-label="Experiments" className={styles.experiments}>
      <h3 className={styles.subheading}>Experiments</h3>
      <ul className={styles.experimentList}>
        {items.map((e) => (
          <ExperimentCard key={e.id} experiment={e} onChange={onChange} />
        ))}
      </ul>
    </section>
  );
}

function ExperimentCard({ experiment: e, onChange }: { experiment: Experiment; onChange: () => void }) {
  const [draft, setDraft] = useState<Draft>({ hypothesis: e.hypothesis.text, procedure: e.procedure, observable: e.observable });
  const [result, setResult] = useState<Result>("confirmed");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const edits = changedParts(e, draft);

  async function patch(body: unknown) {
    setBusy(true);
    setError(null);
    const r = await send("PATCH", `/api/experiments/${e.id}`, body);
    setBusy(false);
    if (r.ok) onChange();
    else setError(r.error);
  }

  const field = (key: keyof Draft, label: string, rows: number) => (
    <label className={styles.experimentField}>
      <span className={styles.label}>{label}</span>
      <textarea rows={rows} maxLength={key === "procedure" ? 2000 : 1000} value={draft[key]} onChange={(v) => setDraft({ ...draft, [key]: v.target.value })} />
    </label>
  );

  return (
    <li className={styles.experiment} data-result={e.result ?? "not run"}>
      <p className={styles.meta}>
        Round {e.round} · Assumption: {e.assumption}
      </p>
      {e.result === null ? (
        <>
          <p className={styles.source}>
            <ClaimBadge label={e.hypothesis.label} /> <span className={styles.label}>Hypothesis</span>
          </p>
          {field("hypothesis", "Hypothesis", 2)}
          {field("procedure", "Procedure (ten minutes)", 4)}
          {field("observable", "What to watch", 2)}
          {Object.keys(edits).length > 0 && (
            <button type="button" disabled={busy} onClick={() => patch(edits)}>
              Save changes
            </button>
          )}
          <p className={styles.result}>Result: Not run</p>
          <div className={styles.row}>
            <label className={styles.field}>
              <span>Result</span>
              <select value={result} onChange={(v) => setResult(v.target.value as Result)}>
                {RESULTS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className={styles.experimentField}>
            <span className={styles.label}>Note (optional)</span>
            <textarea rows={2} maxLength={2000} value={note} onChange={(v) => setNote(v.target.value)} />
          </label>
          <button
            type="button"
            className={styles.primary}
            disabled={busy || Object.keys(edits).length > 0}
            title={Object.keys(edits).length > 0 ? "Save or undo your changes first: the result describes the saved experiment" : undefined}
            onClick={() => patch({ result, note: note.trim() || null })}
          >
            Record result
          </button>
        </>
      ) : (
        <>
          <p className={styles.source}>
            <ClaimBadge label={e.hypothesis.label} /> {e.hypothesis.text}
          </p>
          <p>
            <span className={styles.label}>Procedure:</span> {e.procedure}
          </p>
          <p>
            <span className={styles.label}>What to watch:</span> {e.observable}
          </p>
          <p className={styles.result} data-result={e.result}>
            Result: {resultText(e.result)}
          </p>
          {e.note && <p className={styles.meta}>{e.note}</p>}
        </>
      )}
      {error && <PanelState kind="failed" message={error} />}
    </li>
  );
}
