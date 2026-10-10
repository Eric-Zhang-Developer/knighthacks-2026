"use client";

import { useScribe } from "@elevenlabs/react";
import { useRef, useState, type KeyboardEvent } from "react";
import { getState, setState } from "@/lib/store";
import { appendUtterance } from "@/lib/voice/draft";
import { PanelState } from "@/components/ui";
import { LIVE_TALK_COPY, liveTalkState } from "./state";
import styles from "./voice.module.css";

const MIC_DENIED = "Microphone blocked. Type your idea instead.";
const UNAVAILABLE = "Voice is unavailable right now. Type your idea instead.";

// Push-to-talk: hold to speak, release to commit. Only committed text reaches ideaDraft; the partial is display-only.
export default function Voice() {
  const [holding, setHolding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const holdingRef = useRef(false);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    onCommittedTranscript: ({ text }) => {
      if (!text.trim()) return;
      setState({ ideaDraft: appendUtterance(getState().ideaDraft, text) });
      setAdded(text.trim());
    },
    onError: () => setNotice(UNAVAILABLE),
  });

  async function start() {
    if (holdingRef.current) return;
    holdingRef.current = true;
    setHolding(true);
    setNotice(null);
    if (scribe.isConnected) return scribe.unmute();
    try {
      // Ask for the mic first, so a denial never spends a token.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      return fail(MIC_DENIED);
    }
    const res = await fetch("/api/voice/token", { method: "POST" }).catch(() => null);
    const token = res?.ok ? ((await res.json()) as { token?: string }).token : undefined;
    if (!token) return fail(UNAVAILABLE);
    try {
      await scribe.connect({ token, microphone: { echoCancellation: true, noiseSuppression: true } });
      if (!holdingRef.current) scribe.mute(); // released while connecting
    } catch {
      fail(UNAVAILABLE);
    }
  }

  function stop() {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHolding(false);
    if (!scribe.isConnected) return;
    scribe.commit();
    scribe.mute();
  }

  function interrupt() {
    holdingRef.current = false;
    setHolding(false);
    scribe.clearTranscripts();
    if (scribe.isConnected) scribe.mute();
    setAdded(null);
  }

  function fail(message: string) {
    holdingRef.current = false;
    setHolding(false);
    setNotice(message);
  }

  const key = (e: KeyboardEvent, down: boolean) => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    if (down && !e.repeat) start();
    if (!down) stop();
  };

  const phase = liveTalkState({
    notice,
    holding,
    status: scribe.status,
    partialTranscript: scribe.partialTranscript,
  });
  const stateCopy = LIVE_TALK_COPY[phase];

  function useText() {
    const workspace = document.querySelector<HTMLDetailsElement>("#workspace details");
    if (workspace) workspace.open = true;
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Describe your idea"]')?.focus());
  }

  return (
    <div className={`ui-panel ${styles.bar}`} data-panel="voice" data-live-state={phase}>
      <div className={styles.identity}>
        <span className={styles.liveMark} data-state={phase} aria-hidden>
          {stateCopy.glyph}
        </span>
        <span>
          <h2 className="ui-heading">Live AI Talk</h2>
          <span className={styles.state} role="status" aria-live="polite">
            <strong>{stateCopy.label}</strong> · {stateCopy.detail}
          </span>
        </span>
      </div>
      <button
        type="button"
        className={styles.talk}
        aria-pressed={holding}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onKeyDown={(e) => key(e, true)}
        onKeyUp={(e) => key(e, false)}
      >
        {holding ? "Release to add" : "Hold to talk"}
      </button>
      {holding && (
        <button type="button" className={styles.interrupt} onClick={interrupt}>
          Cancel
        </button>
      )}
      {holding && scribe.partialTranscript ? (
        <p className={styles.transcript} aria-live="polite">
          {scribe.partialTranscript}
        </p>
      ) : added ? (
        <p className={styles.added} aria-live="polite">
          Added to your idea: {added}
        </p>
      ) : null}
      {notice && <PanelState kind="failed" message={notice} onRetry={() => setNotice(null)} />}
      <div className={styles.utility}>
        <button type="button" className={styles.text} onClick={useText}>
          Use text
        </button>
        <button
          type="button"
          className={styles.end}
          aria-label="End voice session"
          disabled={!scribe.isConnected}
          onClick={() => scribe.disconnect()}
        >
          End session
        </button>
      </div>
    </div>
  );
}
