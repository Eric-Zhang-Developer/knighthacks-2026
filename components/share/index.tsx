"use client";

import QRCode from "qrcode";
import { useState } from "react";
import { PanelState } from "@/components/ui";
import { initWorkspace, post } from "@/components/workspace/api";
import { useAppState } from "@/lib/store";
import MomentSection from "./Moment";
import styles from "./share.module.css";

type Share = { token: string; url: string; qr: string };

// The snapshot to share is the one the Decide panel (components/snapshot) is showing; it marks it with
// data-snapshot-id, so sharing needs no new store field.
const chosenSnapshot = () => document.querySelector<HTMLElement>("[data-snapshot-id]")?.dataset.snapshotId ?? null;

export default function SharePanel() {
  const active = useAppState((s) => s.activeIdeaVersionId);
  const [share, setShare] = useState<Share | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!active && !share) return null;

  async function create() {
    const snapshotId = chosenSnapshot();
    if (!snapshotId) return setError("Choose a version in Decide first; that snapshot is what gets shared.");
    setBusy(true);
    setError(null);
    const r = await post<{ token: string; url: string }>("/api/shares", { snapshotId });
    setBusy(false);
    if (!r.ok) return setError(`Couldn't create a link: ${r.error}`);
    // Generated in the browser: the link never goes to a QR service.
    const qr = await QRCode.toDataURL(r.data.url, { margin: 1, width: 192 });
    setRevoked(false);
    setShare({ ...r.data, qr });
  }

  async function revoke() {
    if (!share || !(await initWorkspace()).ok) return;
    setBusy(true);
    const res = await fetch(`/api/shares/${share.token}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError("Couldn't revoke the link. Try again.");
    setRevoked(true);
  }

  return (
    <section className={`ui-panel ${styles.panel}`} aria-label="Share">
      <h2 className="ui-heading">Share</h2>
      {active && <MomentSection versionId={active} />}
      {!share || revoked ? (
        <>
          {revoked && <PanelState kind="empty" message="Link revoked. Anyone opening it now sees that it was revoked." />}
          <button type="button" className={styles.primary} disabled={busy} onClick={create}>
            {revoked ? "Create a new link" : "Create a read-only link"}
          </button>
        </>
      ) : (
        <div className={styles.share}>
          <a href={share.url} target="_blank" rel="noopener noreferrer" className={styles.url} data-share-url>
            {share.url}
          </a>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing to optimize */}
          <img src={share.qr} alt="QR code for the share link" width={192} height={192} className={styles.qr} />
          <p className={styles.meta}>Read-only. Opening it never joins anyone to your workspace.</p>
          <button type="button" disabled={busy} onClick={revoke}>
            Revoke link
          </button>
        </div>
      )}
      {error && <PanelState kind="failed" message={error} />}
    </section>
  );
}
