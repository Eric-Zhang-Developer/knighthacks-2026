"use client";

import { useCallback, useState } from "react";
import AssumptionMap from "./AssumptionMap";
import { lerpStar, replaceStar, type Suggestion as LegacySuggestion, type Version } from "@/components/revisions/trail";
import type { Claim } from "@/lib/ai/claims";
import { ChallengeRevisionReason } from "./revision-reason";
import { ClaimBadge, PanelState } from "@/components/ui";
import { post } from "@/components/workspace/api";
import { getState, setState, useAppState } from "@/lib/store";
import ChangeMind from "./ChangeMind";
import type { Assumption } from "./change-mind";
import { ExperimentList, useExperiments } from "./Experiments";
import { findFor } from "./experiment";
import { nextStep, reviseContext, type Outcome, type Perspective, type Round } from "./rounds";
import styles from "./challenge.module.css";

type Suggestion = Omit<LegacySuggestion, "reason"> & { reason: string | Claim };

const PERSPECTIVES: Perspective[] = ["judge", "user", "engineer"];
const OUTCOME_TEXT: Record<Outcome, string> = {
  revise: "Revise the idea",
  "gather evidence": "Gather evidence",
  test: "Test it",
  "answered well": "Answered well",
};

// Same move as the Revisions panel: the accepted version's star replaces the old one.
function moveStar(from: Version | { versionId: string; x: number; y: number; z: number }, to: Version) {
  const target = { versionId: to.versionId, x: to.x, y: to.y, z: to.z };
  const place = (star: typeof target) =>
    setState({ ideaStars: replaceStar(getState().ideaStars, [from.versionId, to.versionId], star) });
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return place(target);
  const start = performance.now();
  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / 600);
    place(lerpStar(from, target, t));
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

export default function Challenge() {
  const active = useAppState((s) => s.activeIdeaVersionId);
  const [perspective, setPerspective] = useState<Perspective>("judge");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revising, setRevising] = useState<{ round: number; suggestions: Suggestion[] } | null>(null);
  const [revised, setRevised] = useState<number[]>([]); // rounds whose suggestion was accepted
  const experiments = useExperiments(active);
  const [assumptions, setAssumptions] = useState<{ versionId: string; items: Assumption[] } | null>(null);
  // Stable per version: ChangeMind refetches when this changes.
  const onAssumptions = useCallback((items: Assumption[]) => active && setAssumptions({ versionId: active, items }), [active]);

  if (!active) return null;
  const step = nextStep(rounds);

  async function run<T>(label: string, path: string, body?: unknown) {
    setBusy(label);
    setError(null);
    const r = await post<T>(path, body);
    setBusy(null);
    if (!r.ok) setError(r.error);
    return r.ok ? r.data : null;
  }

  async function ask(id: string) {
    const q = await run<Round>("ask", `/api/challenge/${id}/round`);
    if (q) setRounds((rs) => [...rs, q]);
  }

  async function start() {
    setRounds([]);
    setRevising(null);
    setRevised([]);
    const s = await run<{ sessionId: string }>("ask", "/api/challenge", { versionId: active, perspective });
    if (!s) return;
    setSessionId(s.sessionId);
    await ask(s.sessionId);
  }

  async function submit() {
    const text = answer.trim();
    if (!text || !sessionId) return;
    const r = await run<{ outcome: Outcome }>("answer", `/api/challenge/${sessionId}/answer`, { answer: text });
    if (!r) return;
    setRounds((rs) => rs.map((x, i) => (i === rs.length - 1 ? { ...x, answer: text, outcome: r.outcome } : x)));
    setAnswer("");
  }

  async function prove(round: Round) {
    if (!sessionId) return;
    setBusy("prove");
    setError(null);
    const r = await experiments.start(sessionId, round.round);
    setBusy(null);
    if (!r.ok) setError(r.error);
  }

  async function revise(round: Round) {
    const r = await run<{ suggestions: Suggestion[] }>("revise", "/api/revisions/propose", {
      versionId: getState().activeIdeaVersionId,
      context: reviseContext(round),
    });
    if (r) setRevising({ round: round.round, suggestions: r.suggestions });
  }

  async function decide(s: Suggestion, accept: boolean) {
    if (!accept) {
      if (await run(s.id, `/api/revisions/${s.id}/reject`)) {
        setRevising((v) => v && { ...v, suggestions: v.suggestions.filter((x) => x.id !== s.id) });
      }
      return;
    }
    const from = getState().ideaStars.find((x) => x.versionId === getState().activeIdeaVersionId);
    const next = await run<Version>(s.id, `/api/revisions/${s.id}/accept`);
    if (!next) return;
    setRevised((r) => [...r, revising!.round]);
    setRevising(null);
    if (from) moveStar(from, next);
    setState({ activeIdeaVersionId: next.versionId, highlightedIds: next.neighborIds });
  }

  return (
    <section className={`ui-panel ${styles.panel}`} aria-label="Challenge" data-step={step} data-rounds={rounds.length}>
      <h2 className="ui-heading">Challenge my idea</h2>

      {step === "start" && (
        <div className={styles.row}>
          <label className={styles.field}>
            <span>Critic</span>
            <select value={perspective} onChange={(e) => setPerspective(e.target.value as Perspective)}>
              {PERSPECTIVES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={styles.primary} disabled={busy !== null} onClick={start}>
            Challenge my idea
          </button>
        </div>
      )}

      <ol className={styles.rounds} aria-label="Rounds">
        {rounds.map((r) => (
          <li key={r.round} className={styles.round}>
            <p className={styles.meta}>
              Round {r.round} of 3 · {perspective}
            </p>
            <p className={styles.question}>{r.question}</p>
            <p>
              <span className={styles.label}>Assumption:</span> {r.assumption}
            </p>
            <p className={styles.source} aria-label="Source">
              <ClaimBadge label={r.source.label} /> {r.source.text}
              {r.source.sourceIds.length > 0 && (
                <span className={styles.meta}>
                  {" "}
                  · from {r.source.sourceIds.length} project{r.source.sourceIds.length > 1 ? "s" : ""}
                </span>
              )}
            </p>
            {r.answer && (
              <p>
                <span className={styles.label}>Your answer:</span> {r.answer}
              </p>
            )}
            {r.outcome && (
              <p className={styles.outcome} data-outcome={r.outcome}>
                Outcome: {OUTCOME_TEXT[r.outcome]}
              </p>
            )}
            {revised.includes(r.round) && <p className={styles.meta}>Revised: saved as a new version.</p>}
            {r.outcome === "test" &&
              (findFor(experiments.items, sessionId, r.round) ? (
                <p className={styles.meta}>Experiment below, under Experiments.</p>
              ) : (
                <button type="button" className={styles.primary} disabled={busy !== null} onClick={() => prove(r)}>
                  Prove it in ten minutes
                </button>
              ))}
            {r.outcome === "revise" && revising?.round !== r.round && !revised.includes(r.round) && (
              <button type="button" disabled={busy !== null} onClick={() => revise(r)}>
                Suggest revisions for this
              </button>
            )}
            {revising?.round === r.round &&
              (revising.suggestions.length === 0 ? (
                <PanelState kind="empty" message="No suggestions left." />
              ) : (
                <ul className={styles.suggestions} aria-label="Challenge suggestions">
                  {revising.suggestions.map((s) => (
                    <li key={s.id}>
                      <p>
                        <strong>{s.field}:</strong> {s.change}
                      </p>
                      <p className={styles.meta}><ChallengeRevisionReason reason={s.reason} /></p>
                      <div className={styles.row}>
                        <button type="button" className={styles.primary} disabled={busy !== null} onClick={() => decide(s, true)}>
                          Accept
                        </button>
                        <button type="button" disabled={busy !== null} onClick={() => decide(s, false)}>
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ))}
          </li>
        ))}
      </ol>

      {step === "answer" && (
        <form
          className={styles.answer}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <textarea aria-label="Your answer" rows={3} maxLength={8000} value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <button type="submit" className={styles.primary} disabled={busy !== null || !answer.trim()}>
            Answer
          </button>
        </form>
      )}
      {step === "next" && (
        <button type="button" className={styles.primary} disabled={busy !== null} onClick={() => sessionId && ask(sessionId)}>
          Next question
        </button>
      )}
      {step === "done" && (
        <div className={styles.row}>
          <p className={styles.meta}>Three rounds done. That&apos;s the limit for one session.</p>
          <button type="button" className={styles.primary} onClick={() => setRounds([])}>
            New challenge
          </button>
        </div>
      )}
      {busy === "ask" && <PanelState kind="loading" message="The critic is reading your idea…" />}
      {busy === "answer" && <PanelState kind="loading" message="Weighing your answer…" />}
      {busy === "prove" && <PanelState kind="loading" message="Drafting a ten-minute experiment…" />}
      {error && <PanelState kind="failed" message={error} />}
      <ExperimentList items={experiments.items} failed={experiments.failed} onChange={experiments.reload} />
      <ChangeMind key={active} versionId={active} onLoaded={onAssumptions} />
      <AssumptionMap key={`map-${active}`} versionId={active} items={assumptions?.versionId === active ? assumptions.items : []} />
    </section>
  );
}
