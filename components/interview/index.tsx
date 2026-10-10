"use client";

import { useEffect, useRef, useState } from "react";
import { getState, setState, subscribe } from "@/lib/store";
import { appendUtterance } from "@/lib/voice/draft";
import type { Fields } from "@/components/idea/fields";
import { answered, spokenDelta, type Answer, type Round } from "./interview";
import styles from "./interview.module.css";

type Load = { state: "loading" } | { state: "hidden" } | { state: "failed" } | { state: "ready"; round: Round };

// The interview's questions for the current interpretation, one row each with its reason and an answer field.
// It never blocks saving: a missing route (404) hides it silently, other failures leave a quiet note.
export default function Interview({ fields, answers, round, busy, onAnswer, onSkip }: {
  fields: Fields;
  answers: Answer[];
  round: number;
  busy: boolean;
  onAnswer: (next: Answer[]) => void;
  onSkip: () => void;
}) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [typed, setTyped] = useState<string[]>([]);
  const target = useRef<number | null>(null); // the last answer field focused; the mic button takes focus away

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ideas/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields, answers }) })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) return setLoad({ state: "hidden" });
        const json = (await res.json().catch(() => null)) as Round | null;
        if (!res.ok || !json || !Array.isArray(json.questions)) return setLoad({ state: "failed" });
        setTyped(json.questions.map(() => ""));
        setLoad({ state: "ready", round: json });
      }, () => !cancelled && setLoad({ state: "failed" }));
    return () => {
      cancelled = true;
    };
    // One request per round: fields and answers change only by starting the next round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  // Voice commits utterances to the composer draft; while answering, they fill the last focused answer instead.
  useEffect(() => {
    let before = getState().ideaDraft;
    return subscribe(() => {
      const after = getState().ideaDraft;
      const spoken = target.current === null ? null : spokenDelta(before, after);
      if (spoken === null) return void (before = after);
      const i = target.current!;
      setTyped((t) => t.map((v, j) => (j === i ? appendUtterance(v, spoken) : v)));
      setState({ ideaDraft: before }); // the draft stays the idea; the utterance went to the answer
    });
  }, []);

  if (load.state === "hidden") return null;
  if (load.state === "loading") return <p className={styles.note}>Finding what&apos;s still unclear…</p>;
  if (load.state === "failed") return <p className={styles.note}>Couldn&apos;t load follow-up questions. You can save as is.</p>;
  const { questions, done } = load.round;
  if (done || questions.length === 0)
    return <p className={styles.note} role="status">{round > 0 ? "That covers what was unclear. Check the fields and save." : "Nothing unclear to ask about."}</p>;

  const next = answered(questions, typed);
  return (
    <section className={styles.interview} aria-label="Follow-up questions" data-round={round + 1}>
      <p className={styles.label}>A few questions · round {round + 1}</p>
      <ol className={styles.list}>
        {questions.map((q, i) => (
          <li key={`${q.field}-${i}`} className={styles.row}>
            <p className={styles.question}>{q.question}</p>
            <p className={styles.why}>
              <span className={styles.field}>{q.field}</span> {q.why}
            </p>
            <input
              aria-label={q.question}
              value={typed[i] ?? ""}
              disabled={busy}
              placeholder="Type, or hold to talk"
              onFocus={() => (target.current = i)}
              onChange={(e) => setTyped((t) => t.map((v, j) => (j === i ? e.target.value : v)))}
            />
          </li>
        ))}
      </ol>
      <div className={styles.actions}>
        <button type="button" className={styles.use} disabled={busy || next.length === 0} onClick={() => onAnswer(next)}>
          Use my answers
        </button>
        <button type="button" className={styles.skip} disabled={busy} onClick={onSkip}>
          Skip and save
        </button>
      </div>
    </section>
  );
}
