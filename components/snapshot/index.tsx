"use client";

import { useCallback, useEffect, useState } from "react";
import { ClaimBadge, PanelState } from "@/components/ui";
import { initWorkspace, post } from "@/components/workspace/api";
import { useAppState } from "@/lib/store";
import History, { type ListedShare, type ListedSnapshot } from "./History";
import { useRememberedVersion } from "./restore";
import Rubric from "./Rubric";
import styles from "./snapshot.module.css";

type Claim = { text: string; label: "supported" | "inferred" | "unverified"; sourceIds: string[] };
// Shape from decision-snapshot-api (lib/snapshots/contract.ts).
type SnapshotData = {
  versionId: string;
  idea: { title: string | null; description: string | null; problem: string | null; workflow: string | null; constraints: string | null };
  audience: string | null;
  nearestAlternatives: { projectId: string; title: string | null; url: string | null }[];
  whatDiffers: { projectId: string; claims: Claim[] }[];
  mainUncertainty: { projectId: string; claim: Claim } | null;
  nextTest: Claim | null;
};

const Unknown = ({ what }: { what: string }) => <span className={styles.unknown}>{what}</span>;
const ClaimLine = ({ claim }: { claim: Claim }) => (
  <p>
    <ClaimBadge label={claim.label} /> {claim.text}
  </p>
);

export default function Snapshot() {
  const active = useAppState((s) => s.activeIdeaVersionId);
  const [snapshot, setSnapshot] = useState<{ id: string; data: SnapshotData } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ snapshots: ListedSnapshot[]; shares: ListedShare[] }>({ snapshots: [], shares: [] });
  useRememberedVersion();

  // Past snapshots and their links, newest first, from the workspace's saved state. Read only once the shared guest
  // workspace has started: on a first visit an earlier read raced it and got a 401 (#288). Without a workspace there's
  // no history; the workspace badge reports that failure.
  const loadHistory = useCallback(async () => {
    if (!(await initWorkspace()).ok) return;
    const res = await fetch("/api/workspace/state").catch(() => null);
    if (res?.ok) {
      const { snapshots, shares } = await res.json();
      setHistory({ snapshots, shares });
    }
  }, []);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function open(id: string) {
    setError(null);
    const stored = await fetch(`/api/snapshots/${id}`).then((r) => (r.ok ? (r.json() as Promise<SnapshotData>) : null), () => null);
    if (!stored) return setError("Couldn't open that snapshot.");
    setSnapshot({ id, data: stored });
  }

  if (!active && !snapshot && !history.snapshots.length) return null;

  async function choose() {
    setBusy(true);
    setError(null);
    const created = await post<{ snapshotId: string }>("/api/snapshots", { versionId: active });
    // Render only what was stored: read the frozen JSON back rather than trusting anything on screen.
    const stored =
      created.ok && (await initWorkspace()).ok
        ? await fetch(`/api/snapshots/${created.data.snapshotId}`).then((r) => (r.ok ? (r.json() as Promise<SnapshotData>) : null), () => null)
        : null;
    setBusy(false);
    if (!created.ok) return setError(`Couldn't save the snapshot: ${created.error}`);
    if (!stored) return setError("Saved, but couldn't read the snapshot back.");
    setSnapshot({ id: created.data.snapshotId, data: stored });
    loadHistory();
  }

  const d = snapshot?.data;
  const titles = new Map(d?.nearestAlternatives.map((a) => [a.projectId, a.title]) ?? []);
  return (
    <section className={`ui-panel ${styles.panel}`} aria-label="Decision" data-active-version={active ?? ""}>
      <h2 className="ui-heading">Decide</h2>
      {active && (
        <button type="button" className={styles.primary} disabled={busy} onClick={choose}>
          {busy ? "Saving…" : snapshot ? "Choose the current version instead" : "Choose this version"}
        </button>
      )}
      {error && <PanelState kind="failed" message={error} />}

      {snapshot && d && (
        <article className={styles.snapshot} aria-label="Decision snapshot" data-snapshot-id={snapshot.id} data-version-id={d.versionId}>
          <p className={styles.meta}>Decision snapshot · frozen when chosen; later edits don&apos;t change it</p>
          <h3 className={styles.title}>{d.idea.title ?? <Unknown what="Untitled idea" />}</h3>
          {d.idea.description && <p>{d.idea.description}</p>}
          <dl className={styles.facts}>
            <dt>Audience</dt>
            <dd>{d.audience ?? <Unknown what="not stated" />}</dd>
            <dt>Problem</dt>
            <dd>{d.idea.problem ?? <Unknown what="not stated" />}</dd>
            <dt>Workflow</dt>
            <dd>{d.idea.workflow ?? <Unknown what="not stated" />}</dd>
            <dt>Constraints</dt>
            <dd>{d.idea.constraints ?? <Unknown what="not stated" />}</dd>
          </dl>

          <h4>Nearest alternatives</h4>
          {d.nearestAlternatives.length ? (
            <ul className={styles.list}>
              {d.nearestAlternatives.map((a) => (
                <li key={a.projectId}>
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer">
                      {a.title ?? a.url}
                    </a>
                  ) : (
                    (a.title ?? <Unknown what="untitled project" />)
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Unknown what="None recorded" />
          )}

          <h4>What differs</h4>
          {d.whatDiffers.length ? (
            d.whatDiffers.map((w) => (
              <div key={w.projectId} className={styles.group}>
                <p className={styles.meta}>vs {titles.get(w.projectId) ?? "a neighbor"}</p>
                {w.claims.map((c, i) => (
                  <ClaimLine key={i} claim={c} />
                ))}
              </div>
            ))
          ) : (
            <Unknown what="No evidence cards were saved for this version." />
          )}

          <h4>Main uncertainty</h4>
          {d.mainUncertainty ? <ClaimLine claim={d.mainUncertainty.claim} /> : <Unknown what="None recorded" />}

          <h4>Next test</h4>
          {d.nextTest ? <ClaimLine claim={d.nextTest} /> : <Unknown what="No test proposed yet. A challenge can propose one." />}

          <button type="button" className={styles.print} onClick={() => window.print()}>
            Print
          </button>
        </article>
      )}
      {snapshot && d && <Rubric versionId={d.versionId} />}
      <History snapshots={history.snapshots} shares={history.shares} current={snapshot?.id ?? null} onOpen={open} onRevoked={loadHistory} />
    </section>
  );
}
