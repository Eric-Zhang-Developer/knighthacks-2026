"use client";

import { useScribe } from "@elevenlabs/react";
import { useEffect, useRef } from "react";

// The speech SDK (ElevenLabs, with livekit-client inside) is 140 kB gzipped, so it lives in this chunk, loaded when
// someone reaches for the mic (index.tsx), not with the page. It renders nothing and reports up through callbacks.
export type Engine = {
  connect: (options: { token: string; microphone: { echoCancellation: boolean; noiseSuppression: boolean } }) => Promise<void>;
  commit: () => void;
  mute: () => void;
  unmute: () => void;
  disconnect: () => void;
  isConnected: () => boolean;
};

export default function ScribeEngine(props: {
  onReady: (engine: Engine) => void;
  onCommitted: (text: string) => void;
  onPartial: (text: string) => void;
  onConnected: (connected: boolean) => void;
  onError: () => void;
}) {
  const { onReady, onCommitted, onPartial, onConnected, onError } = props;
  const scribe = useScribe({ modelId: "scribe_v2_realtime", onCommittedTranscript: ({ text }) => onCommitted(text), onError });
  const live = useRef(scribe);
  live.current = scribe;
  useEffect(() => {
    onReady({
      connect: (o) => live.current.connect(o),
      commit: () => live.current.commit(),
      mute: () => live.current.mute(),
      unmute: () => live.current.unmute(),
      disconnect: () => live.current.disconnect(),
      isConnected: () => live.current.isConnected,
    });
  }, [onReady]);
  useEffect(() => onPartial(scribe.partialTranscript), [scribe.partialTranscript, onPartial]);
  useEffect(() => onConnected(scribe.isConnected), [scribe.isConnected, onConnected]);
  return null;
}
