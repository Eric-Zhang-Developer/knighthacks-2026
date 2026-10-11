"use client";

import { useEffect, useRef, useState } from "react";
import { latest, type Version } from "@/components/idea/fields";
import { initWorkspace } from "@/components/workspace/api";
import { getState, setState, useAppState } from "@/lib/store";
import { IDEA_INTENT, IDEA_RESULT, IDEA_SELECTED, afterDeletion, confirmsDeletion, resolveIdea, type IdeaIntent } from "./idea-management";
import styles from "./ideas.module.css";

// Integration includes API448/19280d6 and its dedicated test-database receipt.
// Production acceptance and the complete browser journey are still separate gates.
const DELETE_AVAILABLE = true;

export default function IdeaManager() {
  const active = useAppState((state) => state.activeIdeaVersionId);
  const [ideas, setIdeas] = useState<Version[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<Version | null>(null);
  const [busy, setBusy] = useState(false);
  const requestEpoch = useRef(0);
  const selectionEpoch = useRef(0);
  const deleting = useRef(false);
  const mounted = useRef(false);
  const chooser = useRef<HTMLSelectElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const selected = ideas.find((idea) => idea.versionId === active);

  function report(text: string) {
    setNotice(text);
    window.dispatchEvent(new CustomEvent(IDEA_RESULT, { detail: text }));
  }
  function select(version: Version | null) {
    selectionEpoch.current++;
    setPending(null); setError("");
    setState({ activeIdeaVersionId: version?.versionId ?? null, highlightedIds: version?.neighborIds ?? [], selectedProjectId: null, ideaDraft: "" });
    window.dispatchEvent(new CustomEvent(IDEA_SELECTED, { detail: version }));
  }
  function add() {
    select(null);
    location.hash = "idea";
    report("Starting another idea. Existing saved ideas are kept; nothing new has been saved. Ask which problem the user wants to explore next.");
  }

  useEffect(() => {
    mounted.current = true;
    let alive = true;
    const epoch = requestEpoch;
    const lifetime = mounted;
    async function refresh(restore: boolean) {
      const token = ++requestEpoch.current;
      const selection = selectionEpoch.current;
      const originalActive = getState().activeIdeaVersionId;
      try {
        const workspace = await initWorkspace();
        if (!workspace.ok) throw new Error("Your workspace could not load. Please reload to retry.");
        const response = await fetch("/api/ideas", { cache: "no-store" });
        if (!response.ok) throw new Error("Saved ideas could not load. Please reload to retry.");
        const versions = await response.json() as Version[];
        if (!Array.isArray(versions)) throw new Error("The saved-idea response was incomplete.");
        if (!alive || token !== requestEpoch.current) return;
        setIdeas(versions); setLoaded(true); setError("");
        setState({ ideaStars: versions.map(({ versionId, x, y, z }) => ({ versionId, x, y, z })) });
        if (restore && selection === selectionEpoch.current && originalActive === getState().activeIdeaVersionId) {
          const version = versions.find((item) => item.versionId === originalActive) ?? latest(versions);
          // Do not discard a draft composed while the initial list was loading.
          if (!getState().ideaDraft) select(version);
        }
      } catch (failure) {
        if (alive && token === requestEpoch.current) setError(failure instanceof Error ? failure.message : "Saved ideas could not load.");
      }
    }
    const saved = () => { void refresh(false); };
    window.addEventListener("mentor:saved", saved);
    window.addEventListener("ideas:refresh", saved);
    void refresh(true);
    return () => { alive = false; lifetime.current = false; epoch.current++; window.removeEventListener("mentor:saved", saved); window.removeEventListener("ideas:refresh", saved); };
  }, []);

  useEffect(() => { if (pending) cancel.current?.focus(); }, [pending]);
  useEffect(() => { setPending(null); selectionEpoch.current++; }, [active]);
  useEffect(() => {
    const intent = (event: Event) => {
      const command = (event as CustomEvent<IdeaIntent>).detail;
      if (deleting.current) return report("An idea deletion is in progress. Please wait for its result.");
      if (command.kind === "add") return add();
      location.hash = "idea";
      if (!loaded) return report("Saved ideas are not available yet. Nothing was changed.");
      if (command.kind === "list") { chooser.current?.focus(); return report(`Saved ideas: ${ideas.map((idea) => idea.title ?? "Untitled idea").join("; ") || "none"}. Select by the exact saved title or use the picker.`); }
      const version = resolveIdea(ideas, command.title);
      if (!version) return report("That title is missing or ambiguous. Choose the exact idea in the saved-idea picker. Nothing was changed.");
      if (command.kind === "select") { select(version); return report(`Selected ${version.title}. This does not save a new idea.`); }
      setPending(version);
      report(`Review deletion of ${version.title} on screen. Only the visible delete button can confirm; spoken yes cannot delete an idea.${DELETE_AVAILABLE ? "" : " Deletion is currently unavailable while database verification completes."}`);
    };
    window.addEventListener(IDEA_INTENT, intent);
    return () => window.removeEventListener(IDEA_INTENT, intent);
  });

  async function remove() {
    if (!DELETE_AVAILABLE || !pending || deleting.current) return;
    const target = pending;
    if (!ideas.some((idea) => idea.ideaId === target.ideaId && idea.versionId === target.versionId && idea.title === target.title)) {
      setPending(null);
      report("That idea changed after the deletion review. Review it again before deleting; nothing was removed.");
      return;
    }
    const selectedId = selected?.ideaId ?? null;
    const selection = selectionEpoch.current;
    deleting.current = true; setBusy(true); setError("");
    // Invalidate outstanding list responses before the destructive request.
    requestEpoch.current++;
    try {
      const response = await fetch(`/api/ideas/${encodeURIComponent(target.ideaId)}`, { method: "DELETE" });
      const receipt: unknown = await response.json();
      if (!mounted.current) return;
      if (!response.ok || !confirmsDeletion(receipt, target.ideaId)) throw new Error("Deletion was not confirmed. Your selection is kept; reload to check before retrying.");
      const result = afterDeletion(ideas, target.ideaId, selectedId);
      setIdeas(result.remaining);
      setState({ ideaStars: result.remaining.map(({ versionId, x, y, z }) => ({ versionId, x, y, z })) });
      setPending(null);
      if (selection === selectionEpoch.current || getState().activeIdeaVersionId === target.versionId) select(result.selected);
      report(`Deleted ${target.title ?? "Untitled idea"} and its versions. Existing decision snapshots and shared exports remain.`);
      chooser.current?.focus();
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : "Deletion failed. Your ideas are kept."); }
    finally { deleting.current = false; if (mounted.current) setBusy(false); }
  }

  return <section className={styles.manager} aria-label="Saved ideas">
    <div className={styles.toolbar}>
      <label>Saved ideas<select ref={chooser} aria-label="Select saved idea" value={selected?.ideaId ?? ""} disabled={!loaded || busy} onChange={(event) => { const version = ideas.find((idea) => idea.ideaId === event.target.value); if (version) { select(version); report(`Selected ${version.title ?? "Untitled idea"}.`); } }}>
        <option value="" disabled>{loaded ? "New idea" : "Loading ideas…"}</option>
        {ideas.map((idea) => <option key={idea.ideaId} value={idea.ideaId}>{idea.title ?? "Untitled idea"}</option>)}
      </select></label>
      <button type="button" disabled={busy} onClick={add}>+ Add idea</button>
    </div>
    {selected && <details className={styles.manage}><summary>Manage this idea</summary><button type="button" disabled={busy} onClick={() => setPending(selected)}>Delete this idea…</button></details>}
    {pending && <section className={styles.confirm} aria-label="Confirm idea deletion" onKeyDown={(event) => { if (event.key === "Escape" && !busy) { setPending(null); chooser.current?.focus(); } }}>
      <h3>Delete “{pending.title ?? "Untitled idea"}”?</h3>
      <p>This removes all versions of this idea. Existing decision snapshots and shared exports remain. This is not a privacy erase.</p>
      <a href="#decide" onClick={() => select(pending)}>Review shared exports and revocation</a>
      {!DELETE_AVAILABLE && <p>Deletion is unavailable until database verification completes.</p>}
      <div className={styles.actions}><button ref={cancel} type="button" disabled={busy} onClick={() => { setPending(null); chooser.current?.focus(); }}>Cancel</button><button type="button" className={styles.danger} disabled={!DELETE_AVAILABLE || busy} onClick={() => void remove()}>{busy ? "Deleting…" : "Delete idea and all versions"}</button></div>
    </section>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
  </section>;
}
