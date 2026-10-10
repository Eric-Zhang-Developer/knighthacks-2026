"use client";

import Link from "next/link";
import { useState } from "react";
import { PanelState } from "@/components/ui";
import { post, shortId, type Identity } from "./api";
import { NO_RECOVERY } from "./copy";
import styles from "./workspace.module.css";

type State = { state: "idle" | "joining" } | { state: "joined"; identity: Identity } | { state: "gone" } | { state: "failed"; message: string };

// Opening or prefetching this page changes nothing: only the Join button redeems the invite.
export default function Join({ token }: { token: string }) {
  const [s, setS] = useState<State>({ state: "idle" });

  async function join() {
    setS({ state: "joining" });
    const r = await post<Identity>("/api/workspace/invite/redeem", { token });
    if (r.ok) return setS({ state: "joined", identity: r.data });
    setS(r.status === 410 ? { state: "gone" } : { state: "failed", message: r.error });
  }

  return (
    <main className={styles.page}>
      <section className={`ui-panel ${styles.card}`} aria-label="Invite">
        <h1 className="ui-heading">Join a teammate&apos;s workspace</h1>
        {s.state === "joined" ? (
          <>
            <p>
              You joined workspace{" "}
              <span className={styles.id} data-workspace-id={s.identity.workspaceId} title={s.identity.workspaceId}>
                {shortId(s.identity.workspaceId)}
              </span>
              .
            </p>
            <Link className={styles.button} href="/">
              Open the galaxy
            </Link>
          </>
        ) : s.state === "gone" ? (
          <PanelState kind="failed" message="This invite is unavailable: it was already used or has expired. Ask for a new one." />
        ) : (
          <>
            <p>You&apos;ll share one workspace with the person who invited you. A workspace holds two people.</p>
            {s.state === "failed" && <PanelState kind="failed" message={`Couldn't join: ${s.message}`} />}
            <button type="button" className={styles.button} disabled={s.state === "joining"} onClick={join}>
              {s.state === "joining" ? "Joining…" : "Join"}
            </button>
          </>
        )}
        <p className={styles.notice}>{NO_RECOVERY}</p>
      </section>
    </main>
  );
}
