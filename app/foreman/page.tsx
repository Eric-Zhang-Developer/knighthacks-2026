import type { Metadata } from "next";
import localFont from "next/font/local";
import BuildUp from "@/components/foreman/BuildUp";
import CrewTimeline from "@/components/foreman/CrewTimeline";
import { DemoKeys, HeaderClock, Milestones } from "@/components/foreman/Live";
import Pipeline from "@/components/foreman/Pipeline";
import SitePlan from "@/components/foreman/SitePlan";
import Since from "@/components/foreman/Since";
import styles from "@/components/foreman/foreman.module.css";
import { buildBoard, dur, HEAT_HOURS, type Ask, type Board } from "@/lib/foreman/board";
import { beats, buildUp, chapters, timeline, type BuildUp as BuildUpData, type Timeline } from "@/lib/foreman/charts";
import { readRaw, REPO } from "@/lib/foreman/collect";
import { clock } from "@/lib/foreman/time";

// Self-hosted: Google sometimes serves this family from an extensionless URL, which crashes next/font at build time.
const stencil = localFont({ src: "./fonts/big-shoulders-stencil-latin.woff2", weight: "600 800", variable: "--font-stencil" });
// Same self-hosted Plex Mono as the root layout (#226): no Google fetch at build time.
const mono = localFont({
  src: [
    { path: "../fonts/ibm-plex-mono-400-latin.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-mono-500-latin.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono",
});

// Unlisted: nothing links here and search engines are told to stay out. Everything shown is already public.
export const metadata: Metadata = { title: "Foreman · Uncharted", robots: { index: false, follow: false } };
// One snapshot per build (specs/features/foreman/spec.md § Architecture): prerendered once, no GitHub call per view.
// force-static keeps it static even though the collector's fetches say no-store (so Next never caches them).
export const dynamic = "force-static";

const ASK_LABEL: Record<Ask["kind"], string> = {
  stop: "stop",
  ci: "main red",
  merge: "merge me",
  clash: "clash",
  pickable: "cut?",
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

// Times baked into static HTML are absolute: "N min ago" would be wrong a minute after the build.
const at = (iso: string) => clock(Date.parse(iso));
const hhmm = (iso: string) => at(iso).split(" ")[1];

export default async function ForemanPage() {
  const raw = await readRaw();
  const snapshot = Date.parse(raw.fetchedAt);
  const board = buildBoard(raw, snapshot);
  const { api } = board;
  const crew = timeline(raw.prs, snapshot);

  return (
    <main className={`${styles.root} ${stencil.variable} ${mono.variable}`}>
      <header className={styles.header}>
        <span className={`${styles.brand} ${styles.stencil}`}>Foreman</span>
        <span className={`${styles.sub} ${styles.survey}`} data-sha={board.sha} data-snapshot={board.fetchedAt}>
          site office · <a href={`https://github.com/${REPO}`}>{REPO}</a> · surveyed <b>{clock(snapshot)}</b> · main @{" "}
          <b>{board.sha.slice(0, 7)}</b> ·{" "}
          <span className={styles.api} data-testid="api" data-api={!api.token ? "off" : api.error ? "failed" : "ok"}>
            {!api.token
              ? "API: no token"
              : api.error
                ? "API: failed"
                : `API: token · ${api.calls} calls${api.remaining !== null ? ` · ${api.remaining}/${api.limit} left` : ""}`}
          </span>
        </span>
        <HeaderClock now={snapshot} start={board.start} fetchedAt={board.fetchedAt}>
          <DemoKeys beats={beats(board, crew)} />
        </HeaderClock>
      </header>

      {!board.prsKnown && (
        <div className={styles.degraded} role="status" data-testid="degraded">
          <p>
            <strong>PR data missing</strong>
            {api.token
              ? `GitHub's API refused during the build (${api.error}).`
              : "This build ran without GITHUB_TOKEN, so it read no PRs, issues or CI."}{" "}
            Milestones, specs, done notes and gaps below come from the repo at {board.sha.slice(0, 7)} and are true. Features that
            could be under construction show as unknown, and the crew, replay and PR asks are left out until a build reads GitHub.
          </p>
        </div>
      )}
      <Sections board={board} now={snapshot} build={buildUp(board, snapshot)} crew={crew} />
    </main>
  );
}

const NeedsPrs = ({ what }: { what: string }) => <p className={styles.needsPrs}>{what} needs PR data, missing from this snapshot (see above).</p>;

function Sections({ board, now, build, crew }: { board: Board; now: number; build: BuildUpData | null; crew: Timeline | null }) {
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
      <p className={styles.intro} data-testid="intro">
        {board.prsKnown ? (
          <>
            <b>Uncharted</b> was built by <b>{board.stats.crew}</b> agent workers in parallel, under one rulebook (
            <a href={`https://github.com/${board.repo}/blob/main/AGENTS.md`}>AGENTS.md</a>)
            {board.stats.firstPrAt && (
              <>
                , from the first PR at <b>{at(board.stats.firstPrAt)}</b>
              </>
            )}
            .
          </>
        ) : (
          <>
            Agent workers under one rulebook (<a href={`https://github.com/${board.repo}/blob/main/AGENTS.md`}>AGENTS.md</a>) have
            built <b>Uncharted</b>&apos;s <b>{done}</b> of <b>{scheduled.length}</b> planned features.
          </>
        )}{" "}
        Every number here was read from the repo and GitHub at <b>{at(board.fetchedAt)}</b>.
      </p>
      {board.prsKnown && <Since replay={board.replay} features={board.features} now={now} />}

      <section className={styles.section} aria-labelledby="graph">
        <h2 id="graph" className={`${styles.h2} ${styles.stencil}`}>
          Watch it get built{" "}
          <small>every feature in dependency order · hover to trace · click one for its spec and PR</small>
        </h2>
        <div className={styles.panel}>
          <SitePlan features={board.features} replay={board.replay} repo={board.repo} start={board.start} now={now} crew={crew} chapters={chapters(board, crew)} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ms">
        <h2 id="ms" className={`${styles.h2} ${styles.stencil}`}>
          Will we make it? <small>countdown to each milestone · cells = its features</small>
        </h2>
        <Milestones now={now} milestones={board.milestones} features={board.features} prsKnown={board.prsKnown} />
        <div className={styles.panel} style={{ marginTop: 14 }}>
          {build ? <BuildUp data={build} /> : <NeedsPrs what="The build-up chart" />}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ask">
        <div className={styles.split}>
          <div className={styles.panel}>
            <div className={styles.hazard} />
            <h2 id="ask" className={`${styles.h2} ${styles.stencil}`} style={{ padding: "12px 16px 0" }}>
              Needs a person <small>{blocking.length} open · agents can&apos;t clear these themselves</small>
            </h2>
            {!board.prsKnown && <NeedsPrs what="Merging plans, stale drafts, clashes, issues and main's CI" />}
            {blocking.length === 0 ? (
              board.prsKnown && <p className={styles.empty}>Nothing waiting on a person.</p>
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
            <Stat n={board.prsKnown ? board.stats.merged : "—"} label="PRs merged" />
            <Stat n={board.prsKnown ? board.stats.workers : "—"} label={`agents active, ${HEAT_HOURS}h`} />
            <Stat n={board.stats.medianOpenMin === null ? "—" : `${board.stats.medianOpenMin}m`} label="median PR open→merge" />
            {board.prsKnown && (
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
            )}
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
          How it gets built <small>the loop every agent runs, from AGENTS.md · numbers at the snapshot</small>
        </h2>
        <Pipeline board={board} />
      </section>

      <section className={styles.section} aria-labelledby="crew">
        <h2 id="crew" className={`${styles.h2} ${styles.stencil}`}>
          The crew{" "}
          <small>
            {crew ? `every PR on its worker's row · up to ${crew.peak.n} open at once · ` : ""}then what each has open at the snapshot · dot = CI
          </small>
        </h2>
        {!board.prsKnown && <NeedsPrs what="The crew" />}
        {crew && (
          <div className={styles.panel} style={{ marginBottom: 14 }}>
            <CrewTimeline data={crew} />
          </div>
        )}
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
                  <span className={styles.prAge} title={`last push ${at(p.updatedAt)}`}>{hhmm(p.updatedAt)}</span>
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
