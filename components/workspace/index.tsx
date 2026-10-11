"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PanelState } from "@/components/ui";
import { initWorkspace, post, shortId, type Identity } from "./api";
import { NO_RECOVERY } from "./copy";
import styles from "./workspace.module.css";

type Invite = { inviteUrl: string; expiresAt: string };
type InviteState = { state: "idle" | "creating" } | { state: "ready"; invite: Invite } | { state: "failed"; message: string };

// Mounted from app/layout.tsx. Only the home page starts a workspace: invite pages redeem, and share pages
// (/s/*) and every other path never create a session.
export default function Workspace() {
  return usePathname() === "/" ? <HomeWorkspace /> : null;
}

function HomeWorkspace() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteState>({ state: "idle" });

  const start = useCallback(() => {
    setFailed(null);
    initWorkspace().then((r) => (r.ok ? setIdentity(r.data) : setFailed(r.error)));
  }, []);
  useEffect(start, [start]);

  async function createInvite() {
    setInvite({ state: "creating" });
    const r = await post<Invite>("/api/workspace/invite", {});
    if (r.ok) return setInvite({ state: "ready", invite: r.data });
    const message = r.status === 409 ? "Your workspace already has two members." : `Couldn't create an invite: ${r.error}`;
    setInvite({ state: "failed", message });
  }

  if (failed || !identity) {
    return (
      <section className={`ui-panel ${styles.status}`} aria-label="Workspace">
        {failed ? (
          <PanelState kind="failed" message={`Couldn't start your workspace: ${failed}`} onRetry={start} />
        ) : (
          <PanelState kind="loading" message="Starting your workspace…" />
        )}
      </section>
    );
  }
  return (
    <section className={styles.workspace} aria-label="Workspace">
      <div className={styles.identity}>
        <span>
          Workspace{" "}
          <span className={styles.id} data-workspace-id={identity.workspaceId} title={identity.workspaceId}>
            {shortId(identity.workspaceId)}
          </span>
        </span>
        <span className={styles.notice} title={NO_RECOVERY}>
          No accounts: clearing cookies loses it
        </span>
      </div>
      <button
        type="button"
        className={styles.button}
        aria-label="Invite a teammate"
        disabled={invite.state === "creating"}
        onClick={createInvite}
      >
        Invite
      </button>
      {(invite.state === "ready" || invite.state === "failed") && (
        <div className={`ui-panel ${styles.dropdown}`}>
          {invite.state === "ready" ? (
            <InviteLink invite={invite.invite} />
          ) : (
            <PanelState kind="failed" message={invite.message} onRetry={createInvite} />
          )}
          <p className={styles.notice}>{NO_RECOVERY}</p>
          <button type="button" className={styles.button} onClick={() => setInvite({ state: "idle" })}>
            Done
          </button>
        </div>
      )}
    </section>
  );
}

function InviteLink({ invite }: { invite: Invite }) {
  const [copied, setCopied] = useState(false);
  const expires = new Date(invite.expiresAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  return (
    <div>
      <div className={styles.link}>
        <input readOnly aria-label="Invite link" value={invite.inviteUrl} onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className={styles.button}
          onClick={() => navigator.clipboard?.writeText(invite.inviteUrl).then(() => setCopied(true), () => {})}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className={styles.notice}>One teammate, one use. Expires {expires}.</p>
    </div>
  );
}
