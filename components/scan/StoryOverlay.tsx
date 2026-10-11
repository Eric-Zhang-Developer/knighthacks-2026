"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chime, toggleMute, wake } from "./chime";
import { beatEnd, clamp01, countAt, crossed, lineAt, typingEnds } from "./stage";
import { BEAT_AT, BEATS, COUNT_UP, LINES, TWIN_AT, type Story, type StoryState, type Twin } from "./story";
import styles from "./story.module.css";
import "./story-chrome.css";

// The film's speech bubble (./fred-bubble.js) and Fred (components/mentor/fred-pet.js) are custom elements.
type Bubble = HTMLElement & { say?: (text: string, opts?: { cps?: number }) => Promise<void>; close?: () => Promise<void> };
type Fred = HTMLElement & { poke?: () => void };
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "fred-bubble": React.DetailedHTMLProps<React.HTMLAttributes<Bubble>, Bubble> & { who?: string; tail?: string };
    }
  }
}

const IDLE: StoryState = { playing: false, paused: false, t: 0, beat: null };
const fredEl = () => document.querySelector<Fred>("fred-pet");

// The story's stage (specs/features/idea-scan, Plan 5): counter, Fred's bubbles, twin cards, chimes and the presenter's
// HUD. Every frame reads story.state(now), so a pause or a beat skip moves the stage with the camera.
export default function StoryOverlay({ story, total, twins }: { story: Story; total: number; twins: Twin[] }) {
  const [s, setS] = useState<StoryState>(IDLE);
  const [muted, setMuted] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [fredAt, setFredAt] = useState<{ x: number; y: number } | null>(null);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [session, setSession] = useState(0); // restarts the HUD hint on each play
  const prev = useRef<number | null>(null); // last frame's t, for chimes; null after a seek, pause or stop
  const saved = useRef<{ talking: boolean; sleeping: boolean } | null>(null); // Fred before the story

  useEffect(() => {
    void import("./fred-bubble.js");
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // The bubble element, once it is upgraded (say() exists); hidden until the first line, so it never flashes empty.
  const bubbleRef = useCallback((el: Bubble | null) => {
    if (!el) return setBubble(null);
    el.hidden = true;
    void customElements.whenDefined("fred-bubble").then(() => el.isConnected && setBubble(el));
  }, []);

  // Events (play, pause, seek, stop): wake the audio on play (a user gesture), save and restore Fred, and forget the
  // last frame so a seek never chimes.
  useEffect(() => {
    let was = false;
    return story.subscribe((next) => {
      const fred = fredEl();
      if (next.playing && !was) {
        wake();
        setSession((n) => n + 1);
        if (fred) {
          saved.current = { talking: fred.hasAttribute("talking"), sleeping: fred.hasAttribute("sleeping") };
          fred.removeAttribute("sleeping");
        }
      }
      if (!next.playing && was && fred && saved.current) {
        fred.toggleAttribute("talking", saved.current.talking);
        fred.toggleAttribute("sleeping", saved.current.sleeping);
        saved.current = null;
      }
      was = next.playing;
      prev.current = next.playing && !next.paused ? next.t : null;
      setS(next);
    });
  }, [story]);

  // The frame loop, only while the clock runs.
  const running = s.playing && !s.paused;
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const frame = () => {
      const next = story.state(performance.now() / 1000);
      const k = crossed(prev.current, next.t, twins.length);
      if (k >= 0) chime(k);
      prev.current = next.playing && !next.paused ? next.t : null;
      setS(next);
      const r = fredEl()?.getBoundingClientRect();
      const at = r && r.width > 0 ? { x: Math.round(r.left + r.width / 2), y: Math.round(r.top) } : null;
      setFredAt((p) => (p?.x === at?.x && p?.y === at?.y ? p : at));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, story, twins.length]);

  // M mutes the chimes, only while the story plays (and not while typing in a field).
  useEffect(() => {
    if (!s.playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "m" || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      setMuted(toggleMute());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.playing]);

  const t = s.t;
  const line = s.playing ? lineAt(t) : -1;
  const talking = line >= 0 && !s.paused && t < typingEnds(line);

  // A new line pops in and types; no line closes the bubble. The turn line makes Fred hop.
  useEffect(() => {
    if (!bubble?.say) return;
    if (line < 0) void bubble.close?.();
    else void bubble.say(LINES[line].text, reduced ? { cps: 1e6 } : undefined);
  }, [bubble, line, reduced]);
  useEffect(() => {
    if (line >= 0 && LINES[line].beat === "turn") fredEl()?.poke?.();
  }, [line]);
  useEffect(() => {
    if (s.playing) fredEl()?.toggleAttribute("talking", talking);
  }, [talking, s.playing]);

  if (!s.playing) return null;

  const countFade = clamp01((t - COUNT_UP.from + 0.3) / 0.4) * (1 - clamp01((t - BEAT_AT.egg) / 0.6));
  const cardsFade = 1 - clamp01((t - BEAT_AT.turn) / 0.6);

  return (
    <div className={styles.stage}>
      <div className={styles.progress} aria-hidden>
        {BEATS.map((b) => (
          <span key={b} style={{ flexGrow: beatEnd(b) - BEAT_AT[b] }}>
            <i style={{ transform: `scaleX(${clamp01((t - BEAT_AT[b]) / (beatEnd(b) - BEAT_AT[b]))})` }} />
          </span>
        ))}
      </div>
      <p key={session} className={styles.hint} aria-hidden>
        <kbd>Space</kbd> pause · <kbd>←</kbd> <kbd>→</kbd> beats · <kbd>M</kbd> sound · <kbd>Esc</kbd> exit
      </p>
      {(s.paused || muted) && (
        <p className={styles.flags} aria-hidden>
          {s.paused && <span className={styles.paused}>Paused</span>}
          {muted && <span>Sound off</span>}
        </p>
      )}

      {countFade > 0 && (
        <div className={styles.counter} style={{ opacity: countFade }} aria-hidden>
          <strong>{(reduced ? total : countAt(t, total)).toLocaleString()}</strong>
          <span>hackathon projects</span>
        </div>
      )}

      {t >= TWIN_AT[0] && cardsFade > 0 && (
        <ol className={styles.cards} style={{ opacity: cardsFade }} aria-label="Projects like the idea">
          {twins.slice(0, TWIN_AT.length).map((w, k) => {
            if (t < TWIN_AT[k]) return null;
            // "Knight Hacks 2019 · 2019" says the year twice: the year shows only when the event's name lacks it.
            const year = w.year != null && !w.event?.includes(String(w.year)) ? w.year : null;
            const meta = [w.event, year].filter((v) => v != null).join(" · ");
            return (
              <li key={w.id} className={styles.card}>
                <strong>{w.title}</strong>
                {meta && <span>{meta}</span>}
              </li>
            );
          })}
        </ol>
      )}

      <fred-bubble
        ref={bubbleRef}
        who="fred"
        tail="bottom"
        aria-hidden="true"
        className={styles.bubble}
        style={fredAt ? { left: fredAt.x, top: fredAt.y } : undefined}
      />
      <p className={styles.sr} aria-live="polite">
        {line >= 0 ? LINES[line].text : ""}
      </p>
    </div>
  );
}
