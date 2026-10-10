import type { Metadata } from "next";
import { Big_Shoulders_Stencil, IBM_Plex_Mono } from "next/font/google";
import { AutoRefresh, DemoKeys, HeaderClock, Milestones } from "@/components/foreman/Live";
import Pipeline from "@/components/foreman/Pipeline";
import SitePlan from "@/components/foreman/SitePlan";
import Since from "@/components/foreman/Since";
import styles from "@/components/foreman/foreman.module.css";
import { buildBoard, dur, HEAT_HOURS, type Ask, type Board } from "@/lib/foreman/board";
import { readRaw, REPO } from "@/lib/foreman/github";

const stencil = Big_Shoulders_Stencil({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-stencil" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

// Unlisted: nothing links here and search engines are told to stay out. Everything shown is already public.
export const metadata: Metadata = { title: "Foreman · Uncharted", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ASK_LABEL: Record<Ask["kind"], string> = {
  stop: "stop",
  ci: "main red",
  merge: "merge me",
  clash: "clash",
  issue: "decide",
  stale: "dead?",
  review: "review",
};
const KIND_COLOR: Record<string, string> = {
  feature: "#8fef9a",
  fix: "#ffb547",
  plan: "#f4ecdc",
  contract: "#9ab8ff",
  docs: "#6f6656",
  revert: "#e2674a",
  other: "#4a4338",
};

const ago = (now: number, iso: string) => {
  const m = Math.round((now - Date.parse(iso)) / 60_000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
};

export default async function ForemanPage() {
  const now = Date.now();
  let board: Board | null = null;
  let error = "";
  try {
    board = buildBoard(await readRaw(), now);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className={`${styles.root} ${stencil.variable} ${mono.variable}`}>
      <header className={styles.header}>
        <span className={`${styles.brand} ${styles.stencil}`}>Foreman</span>
        <span className={styles.sub}>
          site office · <a href={`https://github.com/${REPO}`}>{REPO}</a>
          {board && ` · main @ ${board.sha.slice(0, 7)}`}
        </span>
        {board && (
          <HeaderClock now={now} start={board.start} fetchedAt={board.fetchedAt}>
            <DemoKeys />
          </HeaderClock>
        )}
        <AutoRefresh />
      </header>

      {!board ? (
        <p className={styles.error} role="alert">
          GitHub data unavailable: {error}. Nothing below is shown rather than showing a guess.
        </p>
      ) : (
        <Sections board={board} now={now} />
      )}
    </main>
  );
}

function Sections({ board, now }: { board: Board; now: number }) {
  const latest = board.replay.slice(-12).reverse();
  const blocking = board.asks.filter((a) => a.kind !== "review");
  const reviews = board.asks.filter((a) => a.kind === "review");
  const scheduled = board.features.filter((f) => f.milestone);
  const done = scheduled.filter((f) => f.state === "done").length;
  const kinds = Object.entries(board.stats.byKind).sort((a, b) => b[1] - a[1]);
  const slowest = board.features
    .filter((f) => f.buildMin !== null)
    .sort((a, b) => b.buildMin! - a.buildMin!)
    .slice(0, 4);

  return (
    <>
      <div className={styles.ticker} aria-label="Latest merges">
        <div className={styles.tickerTrack}>
          {[...latest, ...latest].map((r, i) => (
            <span key={i}>
              <b>#{r.number}</b> {r.title} · {ago(now, r.at)} ago
            </span>
          ))}
        </div>
      </div>
      <Since replay={board.replay} features={board.features} now={now} />

      <section className={styles.section} aria-labelledby="ms">
        <h2 id="ms" className={`${styles.h2} ${styles.stencil}`}>
          Will we make it? <small>countdown to each milestone · cells = its features</small>
        </h2>
        <Milestones now={now} milestones={board.milestones} features={board.features} />
      </section>

      <section className={styles.section} aria-labelledby="ask">
        <div className={styles.split}>
          <div className={styles.panel}>
            <div className={styles.hazard} />
            <h2 id="ask" className={`${styles.h2} ${styles.stencil}`} style={{ padding: "12px 16px 0" }}>
              Needs a person <small>{blocking.length} open · agents can&apos;t clear these themselves</small>
            </h2>
            {blocking.length === 0 ? (
              <p className={styles.empty}>Nothing waiting on a person.</p>
            ) : (
              <ul className={styles.asks} aria-label="Needs a person">
                {blocking.map((a) => (
                  <li key={a.kind + a.title} className={styles.ask} data-kind={a.kind}>
                    <span className={styles.askKind}>{ASK_LABEL[a.kind]}</span>
                    <span>
                      {a.url ? (
                        <a className={styles.askTitle} href={a.url} target="_blank" rel="noreferrer">
                          {a.title}
                        </a>
                      ) : (
                        <span className={styles.askTitle}>{a.title}</span>
                      )}
                      <span className={styles.askDetail}>{a.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {reviews.length > 0 && (
              <details className={styles.reviews}>
                <summary>
                  {reviews.length} done features carry a gap or aren&apos;t verified: merged ≠ verified live ≠ tried by a user
                </summary>
                <ul>
                  {reviews.map((a) => (
                    <li key={a.title}>
                      <a href={a.url!} target="_blank" rel="noreferrer">
                        {a.title}
                      </a>{" "}
                      — {a.detail}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <div className={`${styles.panel} ${styles.stats}`} aria-label="Build stats">
            <Stat n={`${done}/${scheduled.length}`} label="features built" />
            <Stat n={board.stats.merged} label="PRs merged" />
            <Stat n={board.stats.workers} label={`agents active, ${HEAT_HOURS}h`} />
            <Stat n={board.stats.medianOpenMin === null ? "—" : `${board.stats.medianOpenMin}m`} label="median PR open→merge" />
            <div className={styles.mix}>
              <div className={styles.statLabel}>merged PRs by type</div>
              <div className={styles.mixBar}>
                {kinds.map(([k, n]) => (
                  <span key={k} style={{ flex: n, background: KIND_COLOR[k] ?? KIND_COLOR.other }} title={`${k}: ${n}`} />
                ))}
              </div>
              <div className={styles.mixLegend}>
                {kinds.map(([k, n]) => (
                  <span key={k}>
                    <i style={{ background: KIND_COLOR[k] ?? KIND_COLOR.other }} />
                    {k} {n}
                  </span>
                ))}
              </div>
            </div>
            {slowest.length > 0 && (
              <div className={styles.mix}>
                <div className={styles.statLabel}>longest builds · first PR to merge</div>
                <ol className={styles.slow}>
                  {slowest.map((f) => (
                    <li key={f.slug}>
                      <span>{f.slug}</span>
                      <span className={styles.slowBar} style={{ width: `${(f.buildMin! / slowest[0].buildMin!) * 100}%` }} />
                      <b>{dur(f.buildMin!)}</b>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="how">
        <h2 id="how" className={`${styles.h2} ${styles.stencil}`}>
          How it gets built <small>the loop every agent runs, from AGENTS.md · numbers are live</small>
        </h2>
        <Pipeline board={board} />
      </section>

      <section className={styles.section} aria-labelledby="graph">
        <h2 id="graph" className={`${styles.h2} ${styles.stencil}`}>
          The site plan <small>every feature, left to right in dependency order · hover to trace · click for details · replay to watch it get built</small>
        </h2>
        <div className={styles.panel}>
          <SitePlan features={board.features} replay={board.replay} repo={board.repo} start={board.start} heatBasis={board.heatBasis} now={now} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="crew">
        <h2 id="crew" className={`${styles.h2} ${styles.stencil}`}>
          The crew <small>open PRs by worker, as each describes itself · dot = CI</small>
        </h2>
        <div className={styles.crew}>
          {board.lanes.map((l) => (
            <article key={l.worker} className={`${styles.panel} ${styles.lane}`} aria-label={`Worker ${l.worker}`}>
              <div className={styles.laneHead}>
                <span className={`${styles.laneName} ${styles.stencil}`}>{l.worker}</span>
                <span className={styles.laneMerged}>{l.merged} merged</span>
              </div>
              {l.note && <div className={styles.laneNote}>{l.note}</div>}
              {l.prs.map((p) => (
                <a key={p.number} className={styles.lanePr} href={p.url} target="_blank" rel="noreferrer">
                  <span className={styles.ci} data-ci={p.ci ?? "none"} title={`CI: ${p.ci ?? "none"}`} />
                  <span>
                    #{p.number} {p.title}
                    {p.draft ? " · draft" : ""}
                  </span>
                  <span className={styles.prAge}>{ago(now, p.updatedAt)}</span>
                </a>
              ))}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function Stat({ n, label }: { n: string | number; label: string }) {
  return (
    <div className={styles.stat}>
      <div className={`${styles.statNum} ${styles.stencil}`}>{n}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}
