import { ClaimBadge, PanelState } from "@/components/ui";
import { scoreText, sourceTitle, type Point, type Scorecard, type View } from "./scorecard";
import styles from "./scorecard.module.css";

export type ScorecardViewProps = { view: View; onScore: () => void; onOpen: (projectId: string) => void };

function Points({ title, points, card, onOpen }: { title: string; points: Point[]; card: Scorecard; onOpen: (id: string) => void }) {
  return (
    <>
      <p className={styles.part}>{title}</p>
      {points.length ? (
        <ul className={styles.points} aria-label={title}>
          {points.map((p, i) => (
            <li key={i}>
              <ClaimBadge label={p.label} /> {p.text}
              {p.sourceIds.map((id) => (
                <button key={id} type="button" className={styles.cite} onClick={() => onOpen(id)}>
                  {sourceTitle(card, id)}
                </button>
              ))}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.meta}>None given.</p>
      )}
    </>
  );
}

// Every state, no fetching: the container (index.tsx) owns requests. No total and no win odds, by design.
export default function ScorecardView({ view, onScore, onOpen }: ScorecardViewProps) {
  const busy = view.kind === "loading" || view.kind === "scoring";
  return (
    <section className={`ui-panel ${styles.panel}`} aria-label="Scorecard">
      <h2 className="ui-heading">Scorecard</h2>
      <p className={styles.meta}>The event&apos;s five judging criteria, each on its own. Reasons are only as strong as their labels.</p>
      <button type="button" className={styles.primary} disabled={busy} onClick={onScore}>
        {view.kind === "ready" ? "Score again" : "Score this idea"}
      </button>
      {view.kind === "loading" && <PanelState kind="loading" message="Loading the scorecard…" />}
      {view.kind === "empty" && <PanelState kind="empty" message="Not scored yet." />}
      {view.kind === "scoring" && <PanelState kind="loading" message="Scoring against the rubric…" />}
      {view.kind === "failed" && <PanelState kind="failed" message={`Couldn't score this idea: ${view.error}`} onRetry={onScore} />}
      {view.kind === "ready" && (
        <ol className={styles.rows} aria-label="Criteria">
          {view.card.criteria.map((c) => (
            <li key={c.criterion} className={styles.row} data-criterion={c.criterion}>
              <details>
                <summary>
                  <span className={styles.name}>{c.criterion}</span>
                  <span className={styles.score} data-score={c.score ?? "none"}>{scoreText(c)}</span>
                  {c.score !== null && <meter className={styles.meter} min={0} max={5} value={c.score} aria-label={`${c.criterion}: ${c.score} out of 5`} />}
                  <span className={styles.badge}><ClaimBadge label={c.label} /></span>
                </summary>
                <Points title="For" points={c.for} card={view.card} onOpen={onOpen} />
                <Points title="Against" points={c.against} card={view.card} onOpen={onOpen} />
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
