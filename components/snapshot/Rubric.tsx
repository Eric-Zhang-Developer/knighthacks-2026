"use client";

import { useEffect, useState } from "react";
import { ClaimBadge, PanelState } from "@/components/ui";
import { initWorkspace, post } from "@/components/workspace/api";
import tracks from "@/lib/rubric/tracks.json";
import styles from "./snapshot.module.css";

type Claim = {
  text: string;
  label: "supported" | "inferred" | "unverified";
  sourceIds: string[];
};
// Shape from rubric-overlay-api (lib/rubric/contract.ts).
type Track = {
  trackId: string;
  requirement: string | null;
  stated: Claim[];
  speculative: Claim[];
  proof: string | null;
};
type Overlay = { versionId: string; tracks: Track[] };

const names = new Map(tracks.map((t) => [t.id, t.name]));
const Claims = ({ claims, none }: { claims: Claim[]; none: string }) =>
  claims.length ? (
    <>
      {claims.map((c, i) => (
        <p key={i} data-claim>
          <ClaimBadge label={c.label} /> {c.text}
        </p>
      ))}
    </>
  ) : (
    <p className={styles.unknown}>{none}</p>
  );

function Proof({
  versionId,
  track,
  onSaved,
}: {
  versionId: string;
  track: Track;
  onSaved: (o: Overlay) => void;
}) {
  const [text, setText] = useState(track.proof ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function save(proof: string | null) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/rubric/${versionId}/${track.trackId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proof }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError("Couldn't save the proof. Try again.");
    onSaved((await res.json()) as Overlay);
    setEditing(false);
    if (proof === null) setText("");
  }

  const name = names.get(track.trackId) ?? track.trackId;
  return (
    <div className={styles.proof}>
      {track.proof ? (
        <p>
          <span className={styles.meta}>
            Your proof (yours, not checked by Golden Egg):{" "}
          </span>
          {/^https?:\/\/\S+$/.test(track.proof) ? (
            <a href={track.proof} target="_blank" rel="noopener noreferrer">
              {track.proof}
            </a>
          ) : (
            track.proof
          )}
        </p>
      ) : (
        <p className={styles.unknown}>
          Not shown yet: nothing above is proof that it runs.
        </p>
      )}
      {/* One field at a time: 28 open textareas would bury the overlay. */}
      {!editing ? (
        <div className={styles.actions}>
          <button type="button" onClick={() => setEditing(true)}>
            {track.proof ? "Edit proof" : "Attach proof"}
          </button>
          {track.proof && (
            <button type="button" disabled={busy} onClick={() => save(null)}>
              Remove proof
            </button>
          )}
        </div>
      ) : (
        <>
          <label className={styles.field}>
            <span>Proof for {name}</span>
            <textarea
              rows={2}
              maxLength={4000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="A link to a demo, a commit, or a note"
            />
          </label>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={busy || !text.trim() || text.trim() === track.proof}
              onClick={() => save(text.trim())}
            >
              Save proof
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </>
      )}
      {error && <PanelState kind="failed" message={error} />}
    </div>
  );
}

// How the chosen version lines up with the event's tracks. Kept outside the frozen snapshot: proofs change, the snapshot doesn't.
export default function Rubric({ versionId }: { versionId: string }) {
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      setError(null);
      if (!(await initWorkspace()).ok)
        return live && setError("Couldn't open your workspace.");
      // Stored per version: read it, and generate it only the first time.
      const stored = await fetch(`/api/rubric/${versionId}`).catch(() => null);
      const body = await stored?.json().catch(() => null);
      if (stored?.ok) return live && setOverlay(body as Overlay);
      if (stored?.status !== 404)
        return live && setError("Couldn't load the event tracks.");
      const made = await post<Overlay>(`/api/rubric/${versionId}`);
      if (!live) return;
      if (made.ok) setOverlay(made.data);
      else
        setError(`Couldn't map the idea onto the event tracks: ${made.error}`);
    })();
    return () => {
      live = false;
    };
  }, [versionId, attempt]);

  const groups = overlay && [
    // prizes.md gives a "What it rewards" column only for the general challenges; sponsor and MLH rows have none.
    {
      title: "General tracks",
      open: true,
      tracks: overlay.tracks.filter((t) => t.requirement !== null),
    },
    {
      title: "Sponsor and MLH tracks",
      open: false,
      tracks: overlay.tracks.filter((t) => t.requirement === null),
    },
  ];
  return (
    <section
      className={styles.rubric}
      aria-label="Event tracks"
      data-version-id={versionId}
    >
      <h4>Event tracks</h4>
      <p className={styles.meta}>
        What each track asks for, what this idea says it will do, and where it
        might fit. A track counts as shown only when you attach proof.
      </p>
      {error ? (
        <PanelState
          kind="failed"
          message={error}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      ) : !groups ? (
        <PanelState
          kind="loading"
          message="Mapping the idea onto the event tracks…"
        />
      ) : (
        groups.map((g) => (
          <details key={g.title} open={g.open} className={styles.group}>
            <summary>{g.title}</summary>
            {g.tracks.map((t) => (
              <article
                key={t.trackId}
                className={styles.track}
                aria-label={names.get(t.trackId) ?? t.trackId}
                data-track-id={t.trackId}
                data-proof={t.proof ? "attached" : "none"}
              >
                <h5>
                  {names.get(t.trackId) ?? t.trackId}
                  {t.proof && (
                    <span className={styles.shown}> · proof attached</span>
                  )}
                </h5>
                <div className={styles.columns}>
                  <div>
                    <h6>Required</h6>
                    {t.requirement ? (
                      <p>{t.requirement}</p>
                    ) : (
                      <p className={styles.unknown}>
                        prizes.md doesn&apos;t state a requirement for this
                        track.
                      </p>
                    )}
                  </div>
                  <div>
                    <h6>The idea says</h6>
                    <Claims
                      claims={t.stated}
                      none="Nothing in the idea's own words."
                    />
                  </div>
                  <div>
                    <h6>Might fit</h6>
                    <Claims claims={t.speculative} none="Nothing suggested." />
                  </div>
                </div>
                <Proof versionId={versionId} track={t} onSaved={setOverlay} />
              </article>
            ))}
          </details>
        ))
      )}
    </section>
  );
}
