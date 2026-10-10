"use client";

import { useEffect, useState } from "react";
import { ClaimBadge, PanelState, type ClaimLabel } from "@/components/ui";
import { initWorkspace } from "@/components/workspace/api";
import { day, moment } from "./research-groups";
import styles from "./idea.module.css";

// Shape pinned by problem-evidence-api (lib/problem-evidence/contract.ts).
type Claim = { text: string; label: ClaimLabel; sourceIds: string[] };
type Item = { id: string; claim: Claim; about: "problem" | "solution"; source: { title: string; domain: string; url: string | null };
  publishedAt: string | null; eventDate: string | null; relevance: Claim };
type Evidence = { items: Item[]; searchedAt: string };
type View = { kind: "loading" | "idle" | "searching" | "noProblem" } | { kind: "failed"; error: string } | { kind: "ready"; evidence: Evidence };
const SHOWN = 3;

async function call(versionId: string, method: "GET" | "POST"): Promise<{ status: number; evidence?: Evidence; error?: string }> {
  if (!(await initWorkspace()).ok) return { status: 0, error: "No workspace" };
  try {
    const res = await fetch(`/api/problem-evidence/${versionId}`, { method });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { status: res.status, evidence: json as Evidence } : { status: res.status, error: (json as { error?: string }).error ?? `HTTP ${res.status}` };
  } catch {
    return { status: 0, error: "Network error" };
  }
}

function EvidenceItem({ item }: { item: Item }) {
  const { title, domain, url } = item.source;
  return (
    <li className={styles.evidenceItem} data-about={item.about}>
      <p><ClaimBadge label={item.claim.label} /> {item.claim.text}</p>
      <p className={styles.meta}>
        {url ? <a href={url} target="_blank" rel="noopener noreferrer">{title}</a> : title} · {domain} ·{" "}
        {item.publishedAt ? <>published <time dateTime={item.publishedAt}>{day(item.publishedAt)}</time></> : "date not given"}
        {item.eventDate && ` · event date ${item.eventDate}`}
      </p>
      <p className={styles.meta}><ClaimBadge label={item.relevance.label} /> {item.relevance.text}</p>
    </li>
  );
}

// "Is this problem real?": a stored search loads for free; a new one is a grounded web search, so it waits for the button.
export default function ProblemEvidence({ versionId }: { versionId: string }) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let current = true;
    call(versionId, "GET").then((r) => {
      if (current) setView(r.evidence ? { kind: "ready", evidence: r.evidence } : r.status === 404 ? { kind: "idle" } : { kind: "failed", error: r.error! });
    });
    return () => {
      current = false;
    };
  }, [versionId]);

  async function search() {
    setView({ kind: "searching" });
    const r = await call(versionId, "POST");
    if (r.evidence) return setView({ kind: "ready", evidence: r.evidence });
    setView(r.status === 422 ? { kind: "noProblem" } : { kind: "failed", error: r.error! });
  }

  const problems = view.kind === "ready" ? view.evidence.items.filter((i) => i.about === "problem") : [];
  const solutions = view.kind === "ready" ? view.evidence.items.filter((i) => i.about === "solution") : [];
  return (
    <div className={styles.evidence} role="group" aria-label="Is this problem real?">
      {view.kind === "loading" && <PanelState kind="loading" message="Loading problem evidence…" />}
      {view.kind === "idle" && (
        <button type="button" className={styles.secondary} onClick={search}>
          Is this problem real?
        </button>
      )}
      {view.kind === "searching" && <PanelState kind="loading" message="Searching the web for evidence of this problem…" />}
      {view.kind === "noProblem" && <PanelState kind="empty" message="Your idea has no problem stated yet. Add one to check whether it's real." />}
      {view.kind === "failed" && <PanelState kind="failed" message={`Couldn't check the problem: ${view.error}`} onRetry={search} />}
      {view.kind === "ready" && (
        <>
          <p className={styles.evidenceTitle}>Is this problem real?</p>
          <p className={styles.meta}>Searched the web on {moment(view.evidence.searchedAt)}. Each line is only as strong as its label.</p>
          {problems.length ? (
            <ul className={styles.evidenceList} aria-label="About the problem">
              {(expanded ? problems : problems.slice(0, SHOWN)).map((i) => <EvidenceItem key={i.id} item={i} />)}
            </ul>
          ) : (
            <PanelState kind="empty" message="No evidence about the problem itself was found." />
          )}
          {problems.length > SHOWN && !expanded && (
            <button type="button" className={styles.secondary} onClick={() => setExpanded(true)}>
              Show {problems.length - SHOWN} more
            </button>
          )}
          {solutions.length > 0 && (
            <>
              <p className={styles.evidenceTitle}>About solutions, not the problem</p>
              <ul className={styles.evidenceList} aria-label="About solutions, not the problem">
                {solutions.map((i) => <EvidenceItem key={i.id} item={i} />)}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
