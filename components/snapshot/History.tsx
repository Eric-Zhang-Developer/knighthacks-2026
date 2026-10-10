"use client";

import { useState } from "react";
import { PanelState } from "@/components/ui";
import styles from "./snapshot.module.css";

// From GET /api/workspace/state (lib/workspace/state.ts). A share's id is a prefix of its hash, never the token.
export type ListedSnapshot = { id: string; versionId: string; createdAt: string };
export type ListedShare = { id: string; snapshotId: string; createdAt: string; revokedAt: string | null };

const LIMIT = 10;
const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export default function History({ snapshots, shares, current, onOpen, onRevoked }: {
  snapshots: ListedSnapshot[];
  shares: ListedShare[];
  current: string | null;
  onOpen: (id: string) => void;
  onRevoked: () => void;
}) {
  const [all, setAll] = useState(false);
  if (!snapshots.length) return null;
  const shown = all ? snapshots : snapshots.slice(0, LIMIT);
  return (
    <section aria-label="Past snapshots" className={styles.history}>
      <h3 className={styles.subheading}>Past snapshots</h3>
      <ol className={styles.historyList}>
        {shown.map((s) => (
          <li key={s.id} data-snapshot-row={s.id}>
            <button type="button" aria-current={s.id === current} onClick={() => onOpen(s.id)}>
              {when(s.createdAt)}
            </button>
            <ShareRows shares={shares.filter((x) => x.snapshotId === s.id)} onRevoked={onRevoked} />
          </li>
        ))}
      </ol>
      {snapshots.length > LIMIT && !all && (
        <button type="button" onClick={() => setAll(true)}>
          Show all ({snapshots.length})
        </button>
      )}
    </section>
  );
}

function ShareRows({ shares, onRevoked }: { shares: ListedShare[]; onRevoked: () => void }) {
  const [revoked, setRevoked] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  if (!shares.length) return null;

  async function revoke(id: string) {
    setError(null);
    const res = await fetch(`/api/workspace/shares/${id}/revoke`, { method: "POST" }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setError(`Couldn't revoke the link: ${json.error ?? "network error"}`);
    setRevoked((r) => ({ ...r, [id]: json.revokedAt }));
    onRevoked();
  }

  return (
    <ul className={styles.shareRows} aria-label="Share links">
      {shares.map((sh) => {
        const at = revoked[sh.id] ?? sh.revokedAt;
        return (
          <li key={sh.id} className={styles.shareRow} data-share-state={at ? "revoked" : "live"}>
            <span>
              Link from {when(sh.createdAt)} · {at ? `revoked ${when(at)}` : "live"}
            </span>
            {at ? (
              <button type="button" disabled>
                Revoked
              </button>
            ) : (
              <button type="button" onClick={() => revoke(sh.id)}>
                Revoke
              </button>
            )}
          </li>
        );
      })}
      {error && <PanelState kind="failed" message={error} />}
    </ul>
  );
}
