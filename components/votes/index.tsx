"use client";

import { useCallback, useEffect, useState } from "react";
import { PanelState } from "@/components/ui";
import { initWorkspace } from "@/components/workspace/api";
import { useAppState } from "@/lib/store";
import styles from "./votes.module.css";

// Shapes pinned by team-vote-api (lib/votes/service.ts) and idea-create-api.
type Vote = { versionId: string; concern: string | null; changedAfterReveal: boolean };
type Votes = { mine: Vote | null; theirs: null; revealed: false } | { mine: Vote; theirs: Vote; revealed: true; agreement: boolean };
type Version = { ideaId: string; versionId: string; title: string | null };
type Option = { versionId: string; label: string };
const POLL_MS = 4000; // how soon a vote shows the reveal after the teammate votes

async function call<T>(path: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  if (!(await initWorkspace()).ok) return { ok: false, error: "No workspace" };
  try {
    const res = await fetch(path, init);
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: json as T } : { ok: false, error: (json as { error?: string }).error ?? `HTTP ${res.status}` };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

// The latest version of every idea in the workspace, plus every version of the active idea.
async function loadOptions(active: string | null): Promise<Option[]> {
  const ideas = await call<Version[]>("/api/ideas");
  if (!ideas.ok) return [];
  const idea = ideas.data.find((v) => v.versionId === active);
  const trail = idea ? await call<Version[]>(`/api/revisions/trail/${idea.ideaId}`) : null;
  const name = (v: Version) => v.title ?? "Untitled idea";
  const options: Option[] = trail?.ok ? trail.data.map((v, i, all) => ({ versionId: v.versionId, label: all.length > 1 ? `${name(v)} · version ${i + 1}` : name(v) })) : [];
  for (const v of ideas.data) if (!options.some((o) => o.versionId === v.versionId)) options.push({ versionId: v.versionId, label: name(v) });
  return options;
}

function Pick({ who, vote, options }: { who: string; vote: Vote; options: Option[] }) {
  const label = options.find((o) => o.versionId === vote.versionId)?.label ?? "A version not listed here";
  return (
    <div className={styles.pick} data-vote={who}>
      <span className={styles.who}>{who}</span>
      <span>
        {label}
        {vote.changedAfterReveal && <span className={styles.meta}> · changed after reveal</span>}
      </span>
      {vote.concern && <span className={styles.concern}>Concern: {vote.concern}</span>}
    </div>
  );
}

export default function Votes() {
  const active = useAppState((s) => s.activeIdeaVersionId);
  const [options, setOptions] = useState<Option[]>([]);
  const [votes, setVotes] = useState<Votes | null>(null);
  const [choice, setChoice] = useState("");
  const [concern, setConcern] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const r = await call<Votes>("/api/votes");
    if (r.ok) setVotes(r.data);
  }, []);

  useEffect(() => {
    if (!active) return;
    loadOptions(active).then(setOptions);
    refresh();
    const timer = setInterval(refresh, POLL_MS); // the server decides the reveal; the panel only shows what it returns
    return () => clearInterval(timer);
  }, [active, refresh]);

  if (!active || options.length === 0) return null;
  const selected = choice || votes?.mine?.versionId || options[0].versionId;

  async function vote() {
    setBusy(true);
    setError(null);
    const r = await call<Votes>("/api/votes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId: selected, concern: concern.trim() || null }),
    });
    setBusy(false);
    if (!r.ok) return setError(`Couldn't save your vote: ${r.error}`);
    setVotes(r.data);
  }

  return (
    <section className={`ui-panel ${styles.panel}`} aria-label="Team vote">
      <h2 className="ui-heading">Team vote</h2>
      <p className={styles.meta}>Votes stay private until you have both voted.</p>
      <label className={styles.field}>
        <span>Preferred version</span>
        <select value={selected} onChange={(e) => setChoice(e.target.value)}>
          {options.map((o) => (
            <option key={o.versionId} value={o.versionId}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>One concern</span>
        <input value={concern} maxLength={200} onChange={(e) => setConcern(e.target.value)} placeholder="Optional, one line" />
      </label>
      <button type="button" className={styles.primary} disabled={busy} onClick={vote}>
        {votes?.mine ? "Change vote" : "Vote"}
      </button>
      {error && <PanelState kind="failed" message={error} />}
      {votes?.revealed ? (
        <div className={styles.result} role="status" aria-label="Vote result">
          <p className={styles.agreement}>
            <span aria-hidden>{votes.agreement ? "✓" : "≠"}</span> {votes.agreement ? "You agree." : "You picked different versions."}
          </p>
          <Pick who="You" vote={votes.mine} options={options} />
          <Pick who="Teammate" vote={votes.theirs} options={options} />
        </div>
      ) : (
        votes?.mine && (
          <div role="status" aria-label="Vote result">
            <Pick who="You" vote={votes.mine} options={options} />
            <PanelState kind="loading" message="Waiting for your teammate to vote." />
          </div>
        )
      )}
    </section>
  );
}
