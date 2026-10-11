"use client";

import { useEffect, useState } from "react";
import { dur, pace, PACE_HOURS, STATE_TEXT, type Feature, type Milestone } from "@/lib/foreman/board";
import type { Beat } from "@/lib/foreman/charts";
import { clock, span } from "@/lib/foreman/time";
import styles from "./foreman.module.css";

// Starts from the server's `now` so the first client render matches the HTML, then ticks every second.
function useNow(initial: number) {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// Demo mode: keys 1–5 jump to the sections in pitch order, space plays or pauses the replay, and → / ← (or a
// clicker's PageDown / PageUp) step through story mode's beats; Escape leaves it (spec § Story mode).
const SECTIONS = ["graph", "ms", "ask", "how", "crew"]; // pitch order: the tour first (spec § The tour)
const sectionOf = (id: string) => document.getElementById(id)?.closest("section");
const jump = (id: string) =>
  sectionOf(id)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });

export function DemoKeys({ beats }: { beats: Beat[] }) {
  const [beat, setBeat] = useState(-1); // -1: story mode off

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Leave modified keys to the browser, and keys on a focused control to that control.
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as Element).closest?.("input, textarea, select, button, a")) return;
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < SECTIONS.length) {
        e.preventDefault();
        jump(SECTIONS[i]);
      } else if (e.key === " ") {
        e.preventDefault();
        jump("graph");
        window.dispatchEvent(new Event("foreman:replay"));
      } else if (beats.length && (e.key === "ArrowRight" || e.key === "PageDown")) {
        e.preventDefault();
        setBeat((b) => Math.min(b + 1, beats.length - 1));
      } else if (beats.length && (e.key === "ArrowLeft" || e.key === "PageUp")) {
        e.preventDefault();
        setBeat((b) => (b < 0 ? b : Math.max(b - 1, 0)));
      } else if (e.key === "Escape") {
        setBeat(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [beats.length]);

  // Each beat: outline its section, open or close the proof card, and bring the beat into view.
  useEffect(() => {
    const b = beats[beat];
    document.querySelectorAll("section[data-beat]").forEach((el) => el.removeAttribute("data-beat"));
    window.dispatchEvent(new CustomEvent("foreman:open", { detail: b?.open ?? null }));
    if (!b) return;
    sectionOf(b.section)?.setAttribute("data-beat", "");
    // A beat with a card: Graph opens it and scrolls to it once rendered. A statement, not `return jump()`:
    // scrollIntoView returns a Promise in newer browsers, and React would call it as the effect's cleanup.
    if (!b.open) jump(b.section);
  }, [beat, beats]);

  return (
    <>
      <span className={styles.keys} aria-hidden>
        <kbd>1</kbd>–<kbd>5</kbd> sections · <kbd>space</kbd> replay
        {beats.length > 0 && (
          <>
            {" "}
            · <kbd>→</kbd> story
          </>
        )}
      </span>
      {beat >= 0 && (
        <div className={styles.story} role="status" data-testid="story">
          <b className={styles.stencil}>
            {beat + 1} / {beats.length}
          </b>
          <span key={beat} className={styles.captionText}>
            {beats[beat].caption}
          </span>
          <span className={styles.storyKeys} aria-hidden>
            <kbd>←</kbd> <kbd>→</kbd> · <kbd>esc</kbd>
          </span>
        </div>
      )}
    </>
  );
}

const OLD_S = 30 * 60; // spec Defaults: amber past 30 min

export function HeaderClock({
  now: initial,
  start,
  fetchedAt,
  children,
}: {
  now: number;
  start: number | null;
  fetchedAt: string;
  children?: React.ReactNode;
}) {
  const now = useNow(initial);
  const age = Math.round((now - Date.parse(fetchedAt)) / 1000);
  return (
    <div className={styles.meta}>
      {children}
      <span className={styles.live}>
        <b>{clock(now)}</b> EDT
      </span>
      {start !== null && (
        <span>
          {now >= start ? "T+" : "T−"}
          <b>{span(now - start)}</b>
        </span>
      )}
      {/* The page is a snapshot taken at build: its age is the one number here that must keep ticking. */}
      <span className={styles.age} data-old={age > OLD_S ? "" : undefined} title={`Snapshot taken ${fetchedAt}; refreshed by the next deploy`}>
        surveyed <b>{age < 90 ? `${age}s` : age < 5400 ? `${Math.round(age / 60)}m` : dur(Math.round(age / 60))}</b> ago
      </span>
    </div>
  );
}

export function Milestones({
  now: snapshot,
  milestones,
  features,
  prsKnown,
}: {
  now: number;
  milestones: Milestone[];
  features: Feature[];
  prsKnown: boolean;
}) {
  const now = useNow(snapshot);
  const bySlug = new Map(features.map((f) => [f.slug, f]));
  const current = milestones.find((m) => m.ship && m.ship > now)?.name;
  return (
    <div className={styles.milestones}>
      {milestones.map((m) => {
        const passed = m.ship !== null && m.ship <= now;
        const live = m.features.filter((s) => bySlug.has(s) && !m.cut.includes(s));
        const frozen = m.freeze !== null && m.freeze <= now && !passed;
        const cls = [styles.panel, styles.ms, m.name === current && styles.msNow, passed && styles.msPassed].filter(Boolean).join(" ");
        return (
          <article key={m.name} className={cls} aria-label={`Milestone ${m.name}`}>
            <div className={styles.msName}>
              {m.name}
              {m.final && " · final"}
            </div>
            <div className={`${styles.clock} ${styles.stencil}`} data-testid={`clock-${m.name}`}>
              {m.ship === null ? "--:--:--" : span(m.ship - now)}
            </div>
            <div className={styles.msTimes}>
              <span>ships {m.ship ? clock(m.ship) : "no date"}</span>
              {m.freeze && <span>{frozen ? "FROZEN" : "freeze"} {clock(m.freeze)}</span>}
              {m.report && <span>fixes only {clock(m.report)}</span>}
            </div>
            <div className={styles.cells} aria-hidden>
              {live.map((s) => (
                <span key={s} className={styles.cell} data-state={bySlug.get(s)!.state} title={`${s}: ${bySlug.get(s)!.state}`} />
              ))}
            </div>
            <div className={styles.count}>
              <b>{m.done}</b> of {m.total} features done
              {m.cut.length > 0 && ` · ${m.cut.length} on cut list`}
            </div>
            {!passed && live.some((s) => bySlug.get(s)!.state !== "done") && (
              <div className={styles.left}>
                {live
                  .filter((s) => bySlug.get(s)!.state !== "done")
                  .map((s) => (
                    <span key={s} data-state={bySlug.get(s)!.state} title={STATE_TEXT[bySlug.get(s)!.state]}>
                      {s}
                      {bySlug.get(s)!.state === "flight" && bySlug.get(s)!.startedAt && ` · open ${dur(Math.round((snapshot - Date.parse(bySlug.get(s)!.startedAt!)) / 60_000))} at snapshot`}
                    </span>
                  ))}
              </div>
            )}
            {/* Pace reads build times from PR history: without it there is no rate, not a rate of zero. */}
            {!passed && m.ship !== null && prsKnown && <Pace m={m} features={features} now={snapshot} ship={m.ship} />}
            {passed && (
              <span className={`${styles.stamp} ${styles.stencil}`} data-bad={m.done < m.total ? "" : undefined}>
                {m.done < m.total ? `${m.total - m.done} missed` : "shipped"}
              </span>
            )}
          </article>
        );
      })}
    </div>
  );
}

// A crew-wide rate says nothing about one or two stragglers (a single stuck PR would read "on time"), so below
// MIN_LEFT the tile shows how long each has been open instead of a forecast.
const MIN_LEFT = 3;
function Pace({ m, features, now, ship }: { m: Milestone; features: Feature[]; now: number; ship: number }) {
  if (m.total - m.done < MIN_LEFT) return null;
  const p = pace(m, features, now);
  if (!p) return <div className={styles.pace}>no features built in the last {PACE_HOURS}h: no pace to project</div>;
  const late = p.eta > ship;
  return (
    <div className={styles.pace} data-late={late ? "" : undefined} data-testid={`pace-${m.name}`}>
      at the last {PACE_HOURS}h&apos;s pace ({p.perHour.toFixed(1)}/h): ~{clock(p.eta)} · {late ? `~${span(p.eta - ship).slice(0, 5)} late` : "on time"}
    </div>
  );
}
