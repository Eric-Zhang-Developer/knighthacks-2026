"use client";

import { useEffect, useRef, useState } from "react";
import { PanelState } from "@/components/ui";
import { initWorkspace } from "@/components/workspace/api";
import { getState, setState, useAppState } from "@/lib/store";
import { FIELDS, fromForm, galaxyState, hasText, latest, toForm, type FieldName, type Fields, type Version } from "./fields";
import ProblemEvidence from "./ProblemEvidence";
import styles from "./idea.module.css";

type Form = Record<FieldName, string>;
type View =
  | { step: "write" }
  | { step: "interpreting" }
  | { step: "edit"; form: Form; failed: boolean }
  | { step: "saving"; form: Form }
  | { step: "saved"; version: Version };

async function call<T>(path: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const session = await initWorkspace(); // the ideas API needs the guest workspace cookie
  if (!session.ok) return { ok: false, error: `No workspace: ${session.error}` };
  try {
    const res = await fetch(path, init);
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: json as T } : { ok: false, error: (json as { error?: string }).error ?? `HTTP ${res.status}` };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

const postJson = (body: unknown, headers: Record<string, string> = {}) => ({
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});

export default function Idea() {
  const active = useAppState((s) => s.activeIdeaVersionId);
  const draft = useAppState((s) => s.ideaDraft); // voice appends here too
  const [view, setView] = useState<View>({ step: "write" });
  const [error, setError] = useState<string | null>(null);
  // One key per preview, so retrying a save can't create a second idea.
  const saveKey = useRef<string | null>(null);

  // Reload: restore saved ideas from the server, the latest one active.
  useEffect(() => {
    call<Version[]>("/api/ideas").then((r) => {
      if (!r.ok || r.data.length === 0) return;
      setState(galaxyState(r.data));
      setView({ step: "saved", version: latest(r.data)! });
    });
  }, []);

  const saved = view.step === "saved" ? view.version : null;
  useEffect(() => {
    if (!saved || !active || active === saved.versionId) return;
    const ideaId = saved.ideaId;
    let cancelled = false;
    const stale = () => cancelled || getState().activeIdeaVersionId !== active;
    setError(null);
    async function loadSelected() {
      const ideas = await call<Version[]>("/api/ideas");
      if (stale()) return;
      if (!ideas.ok) return setError(`Couldn't load the selected version: ${ideas.error}`);
      let selected = ideas.data.find((v) => v.versionId === active);
      // The list contains only each idea's latest version; branch selection can point into this idea's history.
      if (!selected) {
        const trail = await call<Version[]>(`/api/revisions/trail/${ideaId}`);
        if (stale()) return;
        if (!trail.ok) return setError(`Couldn't load the selected version: ${trail.error}`);
        selected = trail.data.find((v) => v.versionId === active);
      }
      if (!selected) return setError("The selected version is unavailable.");
      const version = selected;
      setView((current) => current.step === "saved" ? { step: "saved", version } : current);
    }
    void loadSelected();
    return () => { cancelled = true; };
  }, [active, saved]);

  async function interpret() {
    const text = getState().ideaDraft.trim();
    if (!text) return;
    setError(null);
    setView({ step: "interpreting" });
    saveKey.current = crypto.randomUUID();
    const r = await call<Fields>("/api/ideas/interpret", postJson({ text }));
    if (r.ok) return setView({ step: "edit", form: toForm(r.data), failed: false });
    // Interpretation failed: keep the typed text and let the user fill the fields by hand.
    setView({ step: "edit", form: toForm({ description: text }), failed: true });
  }

  async function save(form: Form) {
    const fields = fromForm(form);
    if (!hasText(fields)) return setError("Fill in at least one field.");
    setError(null);
    setView({ step: "saving", form });
    const r = await call<Version>("/api/ideas", postJson(fields, { "Idempotency-Key": saveKey.current! }));
    if (!r.ok) {
      setError(`Couldn't save: ${r.error}`);
      return setView({ step: "edit", form, failed: false });
    }
    const others = getState().ideaStars.filter((s) => s.versionId !== r.data.versionId);
    setState({
      ideaStars: [...others, { versionId: r.data.versionId, x: r.data.x, y: r.data.y, z: r.data.z }],
      activeIdeaVersionId: r.data.versionId,
      highlightedIds: r.data.neighborIds,
      ideaDraft: "",
    });
    setView({ step: "saved", version: r.data });
  }

  if (view.step === "saved") {
    const v = view.version;
    return (
      <section
        className={`ui-panel ${styles.idea}`}
        aria-label="Your idea"
        data-version-id={v.versionId}
        data-position={`${v.x},${v.y},${v.z}`}
      >
        <h2 className="ui-heading">{v.title ?? <span className={styles.unknown}>Untitled idea</span>}</h2>
        <p className={styles.meta}>
          Saved as a star among its {v.neighborIds.length} nearest projects, highlighted in the galaxy.
        </p>
        {v.description && <p>{v.description}</p>}
        {v.problem && (
          <p>
            <span className={styles.meta}>Problem:</span> {v.problem}
          </p>
        )}
        <ProblemEvidence key={v.versionId} versionId={v.versionId} />
        {error && <PanelState kind="failed" message={error} />}
        <button type="button" className={styles.secondary} onClick={() => setView({ step: "write" })}>
          New idea
        </button>
      </section>
    );
  }

  if (view.step === "edit" || view.step === "saving") {
    const form = view.form;
    const busy = view.step === "saving";
    const set = (name: FieldName, value: string) => view.step === "edit" && setView({ ...view, form: { ...form, [name]: value } });
    return (
      <section className={`ui-panel ${styles.idea}`} aria-label="Your idea">
        <h2 className="ui-heading">Check the interpretation</h2>
        {view.step === "edit" && view.failed ? (
          <PanelState kind="failed" message="Couldn't interpret your idea. Your text is kept; fill in the fields yourself." />
        ) : (
          <p className={styles.meta}>Nothing is saved until you press Save. Edit anything that&apos;s wrong.</p>
        )}
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            save(form);
          }}
        >
          {FIELDS.map(({ name, label, long }) => (
            <label key={name} className={styles.field}>
              <span>{label}</span>
              {long ? (
                <textarea rows={2} value={form[name]} disabled={busy} onChange={(e) => set(name, e.target.value)} />
              ) : (
                <input value={form[name]} disabled={busy} onChange={(e) => set(name, e.target.value)} />
              )}
            </label>
          ))}
          {error && <PanelState kind="failed" message={error} />}
          <div className={styles.actions}>
            <button type="submit" className={styles.primary} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" className={styles.secondary} disabled={busy} onClick={() => setView({ step: "write" })}>
              Back
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className={`ui-panel ${styles.idea}`} aria-label="Your idea">
      <h2 className="ui-heading">Your idea</h2>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          interpret();
        }}
      >
        <textarea
          aria-label="Describe your idea"
          rows={4}
          maxLength={8000}
          placeholder="Type or hold to talk: what would you build, for whom, and why?"
          value={draft}
          onChange={(e) => setState({ ideaDraft: e.target.value })}
        />
        {view.step === "interpreting" ? (
          <PanelState kind="loading" message="Reading your idea…" />
        ) : (
          <div className={styles.actions}>
            <button type="submit" className={styles.primary} disabled={!draft.trim()}>
              Interpret
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
