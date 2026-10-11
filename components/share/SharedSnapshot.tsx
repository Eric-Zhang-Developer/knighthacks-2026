"use client";

import { useEffect, useState } from "react";
import styles from "./shared.module.css";

type Claim = { text: string; label: "supported" | "inferred" | "unverified"; sourceIds: string[] };
// Shape from decision-snapshot-api (lib/snapshots/contract.ts), as returned by GET /api/shares/:token.
type SnapshotData = {
  idea: { title: string | null; description: string | null; problem: string | null; workflow: string | null; constraints: string | null };
  audience: string | null;
  nearestAlternatives: { projectId: string; title: string | null; url: string | null }[];
  whatDiffers: { projectId: string; claims: Claim[] }[];
  mainUncertainty: { projectId: string; claim: Claim } | null;
  nextTest: Claim | null;
};
type Load = { state: "loading" } | { state: "revoked" } | { state: "missing" } | { state: "failed" } | { state: "ready"; data: SnapshotData };

const Unknown = ({ what }: { what: string }) => <em className={styles.unknown}>{what}</em>;
// Text, not colour, carries the label (same rule as ClaimBadge).
const ClaimLine = ({ claim }: { claim: Claim }) => (
  <p>
    <span className={styles.label}>{claim.label}</span> {claim.text}
  </p>
);

// The public read-only page: it only reads GET /api/shares/:token, which sets no cookie.
export default function SharedSnapshot({ token }: { token: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });

  useEffect(() => {
    fetch(`/api/shares/${encodeURIComponent(token)}`)
      .then(async (r) => {
        // Read the body on every status: an unread error body leaves the request open.
        const body = await r.json().catch(() => null);
        if (r.status === 410) return setLoad({ state: "revoked" });
        if (r.status === 404) return setLoad({ state: "missing" });
        if (!r.ok || !body) return setLoad({ state: "failed" });
        setLoad({ state: "ready", data: body as SnapshotData });
      })
      .catch(() => setLoad({ state: "failed" }));
  }, [token]);

  if (load.state !== "ready") {
    const message = {
      loading: "Loading…",
      revoked: "This link was revoked by its owner.",
      missing: "This link doesn't exist.",
      failed: "Couldn't load this link. Try again later.",
    }[load.state];
    return (
      <main className={styles.page}>
        <p role="status" className={styles.notice} data-share-state={load.state}>
          {message}
        </p>
      </main>
    );
  }

  const d = load.data;
  const titles = new Map(d.nearestAlternatives.map((a) => [a.projectId, a.title]));
  return (
    <main className={styles.page}>
      <article className={styles.card} aria-label="Shared decision">
        <p className={styles.meta}>Uncharted · a hackathon idea, frozen when the team chose it</p>
        <h1>{d.idea.title ?? <Unknown what="Untitled idea" />}</h1>
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
        <h2>Nearest existing projects</h2>
        {d.nearestAlternatives.length ? (
          <ul>
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
        <h2>What differs</h2>
        {d.whatDiffers.length ? (
          d.whatDiffers.map((w) => (
            <div key={w.projectId}>
              <p className={styles.meta}>vs {titles.get(w.projectId) ?? "a neighbor"}</p>
              {w.claims.map((c, i) => (
                <ClaimLine key={i} claim={c} />
              ))}
            </div>
          ))
        ) : (
          <Unknown what="No evidence cards were saved." />
        )}
        <h2>Main uncertainty</h2>
        {d.mainUncertainty ? <ClaimLine claim={d.mainUncertainty.claim} /> : <Unknown what="None recorded" />}
        <h2>Next test</h2>
        {d.nextTest ? <ClaimLine claim={d.nextTest} /> : <Unknown what="No test proposed yet." />}
      </article>
    </main>
  );
}
