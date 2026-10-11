"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { getState, setState } from "@/lib/store";
import { appendUtterance } from "@/lib/voice/draft";
import { PanelState } from "@/components/ui";
import type { Engine } from "./engine";
import styles from "./voice.module.css";

const ScribeEngine = dynamic(() => import("./engine"), { ssr: false });

const MIC_DENIED = "Microphone blocked. Type your idea instead.";
const UNAVAILABLE = "Voice is unavailable right now. Type your idea instead.";

// Push-to-talk: hold to speak, release to commit. Only committed text reaches ideaDraft; the partial is display-only.
export default function Voice() {
  const [holding, setHolding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const holdingRef = useRef(false);
  // The SDK loads on first intent (hover, focus or press), so a visitor who never talks never downloads it. A press
  // that beats the download waits for it below; the button itself is always here, so focus never moves.
  const [wanted, setWanted] = useState(false);
  const [partial, setPartial] = useState("");
  const [connected, setConnected] = useState(false);
  const engine = useRef<Engine | null>(null);
  const [ready] = useState(() => {
    let resolve!: (e: Engine) => void;
    return { promise: new Promise<Engine>((r) => (resolve = r)), resolve };
  });
  const onReady = useCallback((e: Engine) => ((engine.current = e), ready.resolve(e)), [ready]);
  const onCommitted = useCallback((text: string) => {
    if (!text.trim()) return;
    setState({ ideaDraft: appendUtterance(getState().ideaDraft, text) });
    setAdded(text.trim());
  }, []);
  const onError = useCallback(() => setNotice(UNAVAILABLE), []);
  const want = () => setWanted(true);

  async function start() {
    want();
    if (holdingRef.current) return;
    holdingRef.current = true;
    setHolding(true);
    setNotice(null);
    if (engine.current?.isConnected()) return engine.current.unmute();
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
      const scribe = engine.current ?? (await ready.promise);
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
    const scribe = engine.current;
    if (!scribe?.isConnected()) return;
    scribe.commit();
    scribe.mute();
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

  return (
    <div className={`ui-panel ${styles.bar}`} data-panel="voice">
      <h2 className="ui-heading">Speak your idea</h2>
      <button
        type="button"
        className={styles.talk}
        aria-pressed={holding}
        onPointerEnter={want}
        onFocus={want}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onKeyDown={(e) => key(e, true)}
        onKeyUp={(e) => key(e, false)}
      >
        {holding ? "Listening… release to add" : "Hold to talk"}
      </button>
      {holding && partial ? (
        <p className={styles.transcript} aria-live="polite">
          {partial}
        </p>
      ) : added ? (
        <p className={styles.added} aria-live="polite">
          Added to your idea: {added}
        </p>
      ) : null}
      {notice && <PanelState kind="failed" message={notice} />}
      <button type="button" className={styles.end} disabled={!connected} onClick={() => engine.current?.disconnect()}>
        End voice session
      </button>
      {wanted && <ScribeEngine onReady={onReady} onCommitted={onCommitted} onPartial={setPartial} onConnected={setConnected} onError={onError} />}
    </div>
  );
}
