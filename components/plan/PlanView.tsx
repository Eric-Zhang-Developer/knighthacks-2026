import { ClaimBadge, PanelState } from "@/components/ui";
import { hourLabel, validInput, type Plan, type View } from "./plan";
import styles from "./plan.module.css";

export type PlanViewProps = { view: View; previous: Plan[]; hours: number; team: number;
  onHours: (h: number) => void; onTeam: (t: number) => void; onGenerate: () => void };

function Sections({ plan }: { plan: Plan }) {
  return (
    <>
      <p className={styles.part}>Demo tour</p>
      <ol className={styles.list} aria-label="Demo tour">
        {plan.tour.map((t, i) => <li key={i}><ClaimBadge label={t.label} /> {t.text}</li>)}
      </ol>
      <p className={styles.part}>Cut list</p>
      {plan.cut.length ? (
        <ul className={styles.list} aria-label="Cut list">
          {plan.cut.map((c, i) => <li key={i}><ClaimBadge label={c.label} /> {c.text}</li>)}
        </ul>
      ) : (
        <p className={styles.meta}>Nothing to cut.</p>
      )}
      <p className={styles.part}>Timeline</p>
      <ol className={styles.list} aria-label="Timeline">
        {plan.timeline.map((t, i) => (
          <li key={i}><span className={styles.hour}>{hourLabel(t.hour)}</span> <ClaimBadge label={t.label} /> {t.goal}</li>
        ))}
      </ol>
      <p className={styles.part}>Risks</p>
      <ul className={styles.list} aria-label="Risks">
        {plan.risks.map((r, i) => (
          <li key={i}>
            <ClaimBadge label={r.label} /> {r.risk}
            <p className={styles.meta}>Countermeasure: {r.countermeasure}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

// Every state the panel can be in, with no data fetching: the container (index.tsx) owns requests.
export default function PlanView({ view, previous, hours, team, onHours, onTeam, onGenerate }: PlanViewProps) {
  const busy = view.kind === "loading" || view.kind === "generating";
  return (
    <section className={`ui-panel ${styles.panel}`} aria-label="Plan">
      <h2 className="ui-heading">Plan</h2>
      <form className={styles.form} onSubmit={(e) => { e.preventDefault(); onGenerate(); }}>
        <label className={styles.field}>
          <span>Hours left</span>
          <input type="number" min={2} max={72} step={0.5} value={hours} disabled={busy} onChange={(e) => onHours(e.target.valueAsNumber)} />
        </label>
        <label className={styles.field}>
          <span>Team size</span>
          <input type="number" min={1} max={20} step={1} value={team} disabled={busy} onChange={(e) => onTeam(e.target.valueAsNumber)} />
        </label>
        <button type="submit" className={styles.primary} disabled={busy || !validInput(hours, team)}>
          {view.kind === "ready" ? "Regenerate" : "Plan this idea"}
        </button>
      </form>
      {view.kind === "loading" && <PanelState kind="loading" message="Loading your plan…" />}
      {view.kind === "empty" && <PanelState kind="empty" message="No plan yet. Set the hours left and team size, then plan this idea." />}
      {view.kind === "generating" && <PanelState kind="loading" message="Planning the hours left…" />}
      {view.kind === "failed" && <PanelState kind="failed" message={`Couldn't plan this idea: ${view.error}`} onRetry={onGenerate} />}
      {view.kind === "ready" && (
        <>
          <p className={styles.meta}>For {view.plan.hoursLeft} hours and {view.plan.teamSize} {view.plan.teamSize === 1 ? "person" : "people"}. Each line is only as strong as its label.</p>
          <Sections plan={view.plan} />
        </>
      )}
      {previous.map((p) => (
        <details key={p.id} className={styles.previous}>
          <summary>Earlier plan: {p.hoursLeft} hours, {p.teamSize} {p.teamSize === 1 ? "person" : "people"}</summary>
          <Sections plan={p} />
        </details>
      ))}
    </section>
  );
}
