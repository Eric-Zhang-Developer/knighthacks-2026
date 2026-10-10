"use client";

import { useEffect, useState } from "react";
import { ClaimBadge, PanelState, type ClaimLabel } from "@/components/ui";
import { initWorkspace } from "@/components/workspace/api";
import styles from "./rehearsal.module.css";

// Shape pinned by rehearsal-api (lib/rehearsal/contract.ts). Only the workspace view renders this; /s/:token never does.
type Status = "built" | "planned";
type Rehearsal = { versionId: string; built: string[]; pitch: { text: string; status: Status }[];
  questions: { question: string; weakness: string; basis: { text: string; label: ClaimLabel; sourceIds: string[] } }[] };
type View = { kind: "loading" | "idle" | "drafting" | "failed" } | { kind: "ready"; rehearsal: Rehearsal };
const MAX_ITEMS = 8;

async function call(versionId: string, built?: string[]): Promise<{ status: number; rehearsal?: Rehearsal }> {
  if (!(await initWorkspace()).ok) return { status: 0 };
  try {
    const res = await fetch(`/api/rehearsal/${versionId}`, built
      ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ built }) } : {});
    return res.ok ? { status: res.status, rehearsal: (await res.json()) as Rehearsal } : { status: res.status };
  } catch {
    return { status: 0 };
  }
}

// Built and Planned carry a word and a shape, never colour alone.
const StatusBadge = ({ status }: { status: Status }) => (
  <span className={styles.status} data-status={status}>
    <span aria-hidden>{status === "built" ? "■" : "□"}</span>
    {status === "built" ? "Built" : "Planned"}
  </span>
);

export default function RehearseSection({ versionId }: { versionId: string }) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [items, setItems] = useState<string[]>([""]);
  const built = items.map((i) => i.trim()).filter(Boolean);

  // A stored rehearsal is read for free; drafting one is a model call, so it waits for the button.
  useEffect(() => {
    let current = true;
    setView({ kind: "loading" });
    call(versionId).then((r) => {
      if (!current) return;
      if (r.rehearsal) {
        setItems(r.rehearsal.built);
        setView({ kind: "ready", rehearsal: r.rehearsal });
      } else setView(r.status === 404 ? { kind: "idle" } : { kind: "failed" });
    });
    return () => {
      current = false;
    };
  }, [versionId]);

  async function draft() {
    setView({ kind: "drafting" });
    const r = await call(versionId, built);
    setView(r.rehearsal ? { kind: "ready", rehearsal: r.rehearsal } : { kind: "failed" });
  }

  const drafting = view.kind === "drafting";
  return (
    <div className={styles.rehearse} role="group" aria-label="Rehearse">
      <h3 className={styles.heading}>Rehearse</h3>
      {view.kind === "loading" ? (
        <PanelState kind="loading" message="Loading your rehearsal…" />
      ) : (
        <>
          <p className={styles.meta}>What works now? The pitch only calls these working.</p>
          <ol className={styles.items}>
            {items.map((item, i) => (
              <li key={i}>
                <input
                  aria-label={`What works now, item ${i + 1}`}
                  value={item}
                  maxLength={120}
                  disabled={drafting}
                  placeholder="e.g. voice search for recipes"
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <button type="button" aria-label={`Remove item ${i + 1}`} disabled={drafting || items.length === 1}
                  onClick={() => setItems(items.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </li>
            ))}
          </ol>
          <div className={styles.actions}>
            <button type="button" disabled={drafting || items.length >= MAX_ITEMS} onClick={() => setItems([...items, ""])}>
              Add an item
            </button>
            <button type="button" className={styles.primary} disabled={drafting || built.length === 0} onClick={draft}>
              {drafting ? "Drafting…" : "Draft pitch"}
            </button>
          </div>
          {built.length === 0 && <p className={styles.meta}>List at least one thing that works now.</p>}
        </>
      )}
      {view.kind === "failed" && <PanelState kind="failed" message="Couldn't draft the pitch. Try again." />}
      {view.kind === "ready" && (
        <>
          <p className={styles.part}>Pitch</p>
          <ul className={styles.pitch} aria-label="Pitch">
            {view.rehearsal.pitch.map((s, i) => (
              <li key={i}><StatusBadge status={s.status} /> {s.text}</li>
            ))}
          </ul>
          <p className={styles.part}>A judge might ask</p>
          <ol className={styles.questions} aria-label="Judge questions">
            {view.rehearsal.questions.map((q, i) => (
              <li key={i}>
                <p>{q.question}</p>
                <p className={styles.meta}>Probes: {q.weakness}</p>
                <p className={styles.meta}><ClaimBadge label={q.basis.label} /> {q.basis.text}</p>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
