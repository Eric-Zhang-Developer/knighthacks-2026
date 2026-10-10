"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Feature, Milestone } from "@/lib/foreman/board";
import styles from "./foreman.module.css";

export const TZ = "America/New_York"; // the event's clock (milestones.toml times are EDT)

// Starts from the server's `now` so the first client render matches the HTML, then ticks every second.
function useNow(initial: number) {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
export function span(ms: number) {
  const s = Math.max(0, Math.floor(Math.abs(ms) / 1000));
  return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;
}
export const clock = (t: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(t);

// A dashboard left open on a laptop should keep up without a reload. Client state (a replay in progress) survives.
export function AutoRefresh({ every = 60_000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && router.refresh(), every);
    return () => clearInterval(id);
  }, [router, every]);
  return null;
}

export function HeaderClock({ now: initial, start, fetchedAt }: { now: number; start: number | null; fetchedAt: string }) {
  const now = useNow(initial);
  const age = Math.round((now - Date.parse(fetchedAt)) / 1000);
  return (
    <div className={styles.meta}>
      <span className={styles.live}>
        <b>{clock(now)}</b> EDT
      </span>
      {start !== null && (
        <span>
          {now >= start ? "T+" : "T−"}
          <b>{span(now - start)}</b>
        </span>
      )}
      <span title={`GitHub data as of ${fetchedAt}`}>
        data <b>{age < 90 ? `${age}s` : `${Math.round(age / 60)}m`}</b> old
      </span>
    </div>
  );
}

export function Milestones({ now: initial, milestones, features }: { now: number; milestones: Milestone[]; features: Feature[] }) {
  const now = useNow(initial);
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
              {m.cut.length > 0 && ` · ${m.cut.length} cut`}
            </div>
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
