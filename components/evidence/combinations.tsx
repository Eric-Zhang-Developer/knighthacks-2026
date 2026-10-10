"use client";

import { useEffect, useState } from "react";
import { ClaimBadge, PanelState, type ClaimLabel } from "@/components/ui";
import { initWorkspace, post } from "@/components/workspace/api";
import { setState } from "@/lib/store";
import styles from "./evidence.module.css";

type Claim = { text: string; label: ClaimLabel; sourceIds: string[] };
// Shape from combinations-api (lib/combinations/contract.ts).
type Suggestion = { user: string; benefit: Claim; workflow: string[]; workflowIsProposal: true; sources: { projectId: string; title: string; url: string }[]; claims: Claim[] };
type View = { kind: "loading" } | { kind: "failed"; error: string } | { kind: "ready"; suggestions: Suggestion[] };

// Stored per version: read it, and generate only the first time.
async function load(versionId: string): Promise<View> {
  if (!(await initWorkspace()).ok) return { kind: "failed", error: "couldn't open your workspace" };
  const stored = await fetch(`/api/combinations/${versionId}`).catch(() => null);
  const body = await stored?.json().catch(() => null);
  if (stored?.ok) return { kind: "ready", suggestions: body.suggestions };
  if (stored?.status !== 404) return { kind: "failed", error: body?.error ?? "network error" };
  const made = await post<{ suggestions: Suggestion[] }>(`/api/combinations/${versionId}`);
  return made.ok ? { kind: "ready", suggestions: made.data.suggestions } : { kind: "failed", error: made.error };
}

function Combination({ s }: { s: Suggestion }) {
  return (
    <article className={`${styles.card} ${styles.combo}`} aria-label={`Combination for ${s.user}`}>
      <h3 className={styles.comboTitle}>For {s.user}</h3>
      {/* Both sources, always: a suggestion never shows without the two real projects it comes from. */}
      <ul className={styles.joins} aria-label="Source projects">
        {s.sources.map((p) => (
          <li key={p.projectId}>
            <button type="button" className={styles.open} onClick={() => setState({ selectedProjectId: p.projectId })}>
              {p.title}
            </button>{" "}
            <a className={styles.source} href={p.url} target="_blank" rel="noopener noreferrer">
              Source ↗
            </a>
          </li>
        ))}
      </ul>
      <p className={styles.subheading}>Benefit</p>
      <p>
        <ClaimBadge label={s.benefit.label} /> {s.benefit.text}
      </p>
      <p className={styles.subheading}>Proposed workflow</p>
      <p className={styles.muted}>A proposal to try, not something either project does today.</p>
      <ol className={styles.claims}>
        {s.workflow.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      {s.claims.length > 0 && (
        <>
          <p className={styles.subheading}>From the sources</p>
          <ul className={styles.claims}>
            {s.claims.map((c, i) => (
              <li key={i}>
                <ClaimBadge label={c.label} /> {c.text}
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}

export default function Combinations({ versionId }: { versionId: string }) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let current = true;
    setView({ kind: "loading" });
    setAll(false);
    load(versionId).then((v) => current && setView(v));
    return () => {
      current = false;
    };
  }, [versionId, attempt]);

  const shown = view.kind === "ready" ? (all ? view.suggestions : view.suggestions.slice(0, 1)) : [];
  const hidden = view.kind === "ready" ? view.suggestions.length - shown.length : 0;
  return (
    <section className={`ui-panel ${styles.evidence}`} aria-label="Combine ideas">
      <h2 className="ui-heading">Combine ideas</h2>
      <p className={styles.muted}>Workflows that join two of your idea&apos;s real neighbors.</p>
      {view.kind === "loading" && <PanelState kind="loading" message="Looking for combinations of neighboring projects…" />}
      {view.kind === "failed" && <PanelState kind="failed" message={`Couldn't load combinations: ${view.error}`} onRetry={() => setAttempt((n) => n + 1)} />}
      {view.kind === "ready" && view.suggestions.length === 0 && <PanelState kind="empty" message="No combination of two neighbors held up." />}
      {shown.map((s, i) => (
        <Combination key={i} s={s} />
      ))}
      {hidden > 0 && (
        <button type="button" className={styles.more} onClick={() => setAll(true)}>
          Show {hidden === 1 ? "one more combination" : "the other combinations"}
        </button>
      )}
    </section>
  );
}
