"use client";

import { useEffect, useState } from "react";
import { ClaimBadge, PanelState } from "@/components/ui";
import { initWorkspace } from "@/components/workspace/api";
import { GROUPS, kindOf, moment, popularity, SOURCE_TEXT, unavailableText, type Item, type Research } from "./research-groups";
import styles from "./idea.module.css";

type View = { kind: "loading" | "idle" | "searching" } | { kind: "failed"; error: string } | { kind: "ready"; research: Research };
const SHOWN = 2;

async function call(versionId: string, method: "GET" | "POST"): Promise<{ status: number; research?: Research; error?: string }> {
  if (!(await initWorkspace()).ok) return { status: 0, error: "No workspace" };
  try {
    const res = await fetch(`/api/research/${versionId}`, { method });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { status: res.status, research: json as Research } : { status: res.status, error: (json as { error?: string }).error ?? `HTTP ${res.status}` };
  } catch {
    return { status: 0, error: "Network error" };
  }
}

function ResearchItem({ item }: { item: Item }) {
  const pop = popularity(item.popularity);
  return (
    <li className={styles.evidenceItem} data-source={item.source}>
      <p>
        <a href={item.url} target="_blank" rel="noopener noreferrer">{item.name}</a>{" "}
        <span className={styles.meta}>· {SOURCE_TEXT[item.source]}{pop && ` · ${pop}`}</span>
      </p>
      {item.description && <p className={styles.meta}>{item.description}</p>}
      <p className={styles.meta}><ClaimBadge label={item.reason.label} /> {item.reason.text}</p>
    </li>
  );
}

function Group({ title, items }: { title: string; items: Item[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <p className={styles.groupTitle}>{title}</p>
      <ul className={styles.evidenceList} aria-label={title}>
        {(expanded ? items : items.slice(0, SHOWN)).map((i) => <ResearchItem key={i.id} item={i} />)}
      </ul>
      {items.length > SHOWN && !expanded && (
        <button type="button" className={styles.secondary} onClick={() => setExpanded(true)}>
          Show {items.length - SHOWN} more
        </button>
      )}
    </>
  );
}

// "What already exists?": a stored result loads for free; a new search calls GitHub, Hugging Face and the model twice,
// so it waits for the button.
export default function ResearchSection({ versionId }: { versionId: string }) {
  const [view, setView] = useState<View>({ kind: "loading" });

  useEffect(() => {
    let current = true;
    call(versionId, "GET").then((r) => {
      if (current) setView(r.research ? { kind: "ready", research: r.research } : r.status === 404 ? { kind: "idle" } : { kind: "failed", error: r.error! });
    });
    return () => {
      current = false;
    };
  }, [versionId]);

  async function run() {
    setView({ kind: "searching" });
    const r = await call(versionId, "POST");
    setView(r.research ? { kind: "ready", research: r.research } : { kind: "failed", error: r.error! });
  }

  return (
    <div className={styles.evidence} role="group" aria-label="What already exists?">
      {view.kind === "loading" && <PanelState kind="loading" message="Loading related work…" />}
      {view.kind === "idle" && (
        <button type="button" className={styles.secondary} onClick={run}>
          What already exists?
        </button>
      )}
      {view.kind === "searching" && <PanelState kind="loading" message="Searching GitHub and Hugging Face…" />}
      {view.kind === "failed" && <PanelState kind="failed" message={`Couldn't search for related work: ${view.error}`} onRetry={run} />}
      {view.kind === "ready" && (
        <>
          <p className={styles.evidenceTitle}>What already exists?</p>
          <p className={styles.meta}>Searched on {moment(view.research.searchedAt)}.</p>
          {view.research.unavailable.map((u) => (
            <PanelState key={u.source} kind="partial" message={unavailableText(u)} />
          ))}
          {view.research.items.length === 0 && <PanelState kind="empty" message="No related repositories, models, Spaces or datasets were found." />}
          {GROUPS.map(({ kind, title }) => {
            const items = view.research.items.filter((i) => kindOf(i) === kind);
            return items.length ? <Group key={kind} title={title} items={items} /> : null;
          })}
        </>
      )}
    </div>
  );
}
