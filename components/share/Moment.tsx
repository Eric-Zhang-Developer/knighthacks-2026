"use client";

import { useEffect, useState } from "react";
import { ClaimBadge, PanelState, type ClaimLabel } from "@/components/ui";
import { initWorkspace } from "@/components/workspace/api";
import styles from "./share.module.css";

// Shape pinned by moment-api (lib/moment/contract.ts). Only the workspace view renders this; /s/:token never does.
type Claim = { text: string; label: ClaimLabel; sourceIds: string[] };
type Moment = { versionId: string; steps: { judgeDoes: string; appears: string; demonstrates: Claim }[]; basis: Claim[] };
type View = { kind: "loading" | "none" | "generating" } | { kind: "failed"; error: string } | { kind: "ready"; moment: Moment };

async function call(versionId: string, method: "GET" | "POST"): Promise<{ status: number; moment?: Moment; error?: string }> {
  if (!(await initWorkspace()).ok) return { status: 0, error: "No workspace" };
  try {
    const res = await fetch(`/api/moment/${versionId}`, { method });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { status: res.status, moment: json as Moment } : { status: res.status, error: (json as { error?: string }).error ?? `HTTP ${res.status}` };
  } catch {
    return { status: 0, error: "Network error" };
  }
}

const Labelled = ({ claim }: { claim: Claim }) => (
  <>
    <ClaimBadge label={claim.label} /> {claim.text}
  </>
);

export default function MomentSection({ versionId }: { versionId: string }) {
  const [view, setView] = useState<View>({ kind: "loading" });

  // A stored moment is read for free; generating one is a model call, so it waits for the button.
  useEffect(() => {
    let current = true;
    setView({ kind: "loading" });
    call(versionId, "GET").then((r) => {
      if (!current) return;
      if (r.moment) setView({ kind: "ready", moment: r.moment });
      else setView(r.status === 404 ? { kind: "none" } : { kind: "failed", error: r.error! });
    });
    return () => {
      current = false;
    };
  }, [versionId]);

  async function generate() {
    setView({ kind: "generating" });
    const r = await call(versionId, "POST");
    setView(r.moment ? { kind: "ready", moment: r.moment } : { kind: "failed", error: r.error! });
  }

  return (
    <div className={styles.moment} aria-label="Show me the moment" role="group">
      <h3 className={styles.momentHeading}>Show me the moment</h3>
      {view.kind === "loading" && <PanelState kind="loading" message="Loading the demo moment…" />}
      {view.kind === "none" && (
        <>
          <p className={styles.meta}>Three steps a judge could try with this version, before you share it.</p>
          <button type="button" className={styles.primary} onClick={generate}>
            Show me the moment
          </button>
        </>
      )}
      {view.kind === "generating" && <PanelState kind="loading" message="Drafting three steps for a judge…" />}
      {view.kind === "failed" && <PanelState kind="failed" message={`Couldn't draft the moment: ${view.error}`} onRetry={generate} />}
      {view.kind === "ready" && (
        <>
          <ol className={styles.steps}>
            {view.moment.steps.map((s, i) => (
              <li key={i}>
                <p><span className={styles.part}>Judge does</span> {s.judgeDoes}</p>
                <p><span className={styles.part}>What appears</span> {s.appears}</p>
                <p><span className={styles.part}>Demonstrates</span> <Labelled claim={s.demonstrates} /></p>
              </li>
            ))}
          </ol>
          <p className={styles.part}>Based on</p>
          <ul className={styles.basis}>
            {view.moment.basis.map((c, i) => (
              <li key={i}>
                <Labelled claim={c} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
