"use client";

import { useEffect, useState } from "react";
import { ClaimBadge, PanelState, type ClaimLabel } from "@/components/ui";
import { initWorkspace } from "@/components/workspace/api";
import { setState, useAppState } from "@/lib/store";
import StrongestAlternative from "./alternative";
import Combinations from "./combinations";
import styles from "./evidence.module.css";

// Shape pinned by neighbor-evidence-api (lib/evidence/contract.ts).
type Claim = { text: string; label: ClaimLabel; sourceIds: string[] };
type Card = { projectId: string; url: string; title: string; excerpt: string; overlaps: Claim[]; differences: Claim[]; uncertainty: Claim };
type View =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "failed"; error: string }
  | { kind: "ready"; cards: Card[]; all: boolean; more: "idle" | "loading" | string };

// POST returns stored cards without regenerating, so it is also how a reload reads them back.
async function fetchCards(versionId: string, all: boolean): Promise<{ ok: true; cards: Card[] } | { ok: false; error: string }> {
  const session = await initWorkspace(); // the evidence API needs the guest workspace cookie
  if (!session.ok) return { ok: false, error: `No workspace: ${session.error}` };
  try {
    const res = await fetch(`/api/evidence/${versionId}${all ? "?all=true" : ""}`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, cards: (json as { cards: Card[] }).cards } : { ok: false, error: (json as { error?: string }).error ?? `HTTP ${res.status}` };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

function Claims({ heading, claims }: { heading: string; claims: Claim[] }) {
  return (
    <div>
      <h4 className={styles.subheading}>{heading}</h4>
      {claims.length ? (
        <ul className={styles.claims}>
          {claims.map((c, i) => (
            <li key={i}>
              <ClaimBadge label={c.label} /> {c.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>None found.</p>
      )}
    </div>
  );
}

function EvidenceCard({ card }: { card: Card }) {
  return (
    <article className={styles.card} aria-label={`Evidence: ${card.title}`} data-project-id={card.projectId}>
      <h3 className={styles.title}>
        <button type="button" className={styles.open} onClick={() => setState({ selectedProjectId: card.projectId })}>
          {card.title}
        </button>
      </h3>
      <a className={styles.source} href={card.url} target="_blank" rel="noopener noreferrer">
        Source ↗
      </a>
      <Claims heading="Shared with your idea" claims={card.overlaps} />
      <Claims heading="Different from your idea" claims={card.differences} />
      <details className={styles.details}>
        <summary>Uncertainty and source excerpt</summary>
        <p>
          <ClaimBadge label={card.uncertainty.label} /> {card.uncertainty.text}
        </p>
        <blockquote className={styles.excerpt}>{card.excerpt.slice(0, 600)}</blockquote>
      </details>
    </article>
  );
}

export default function Evidence() {
  const versionId = useAppState((s) => s.activeIdeaVersionId);
  const [view, setView] = useState<View>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!versionId) return setView({ kind: "idle" });
    let current = true; // a newer version replaces this request's result
    setView({ kind: "loading" });
    fetchCards(versionId, false).then((r) => {
      if (current) setView(r.ok ? { kind: "ready", cards: r.cards, all: false, more: "idle" } : { kind: "failed", error: r.error });
    });
    return () => {
      current = false;
    };
  }, [versionId, attempt]);

  if (view.kind === "idle" || !versionId) return null;

  async function showAll() {
    if (view.kind !== "ready") return;
    setView({ ...view, more: "loading" });
    const r = await fetchCards(versionId!, true);
    setView(r.ok ? { kind: "ready", cards: r.cards, all: true, more: "idle" } : { ...view, more: r.error });
  }

  return (
    <>
      <StrongestAlternative versionId={versionId} />
      <section className={`ui-panel ${styles.evidence}`} aria-label="Evidence">
        <h2 className="ui-heading">How it compares</h2>
        {view.kind === "loading" && <PanelState kind="loading" message="Comparing your idea with its nearest projects…" />}
        {view.kind === "failed" && (
          <PanelState kind="failed" message={`Couldn't load evidence: ${view.error}`} onRetry={() => setAttempt((n) => n + 1)} />
        )}
        {view.kind === "ready" && (
          <>
            {view.cards.length === 0 && <PanelState kind="empty" message="No evidence for this idea yet." />}
            {view.cards.map((card) => (
              <EvidenceCard key={card.projectId} card={card} />
            ))}
            {view.more === "loading" && <PanelState kind="loading" message="Comparing the remaining neighbors…" />}
            {view.more !== "idle" && view.more !== "loading" && (
              <PanelState kind="failed" message={`Couldn't load the remaining neighbors: ${view.more}`} onRetry={showAll} />
            )}
            {!view.all && view.more === "idle" && (
              <button type="button" className={styles.more} onClick={showAll}>
                Compare the remaining neighbors
              </button>
            )}
          </>
        )}
      </section>
      <Combinations versionId={versionId} />
    </>
  );
}
