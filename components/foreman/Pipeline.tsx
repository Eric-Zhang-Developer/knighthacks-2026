import type { Board } from "@/lib/foreman/board";
import styles from "./foreman.module.css";

// The loop every agent runs (AGENTS.md), each step with the snapshot's number that shows it happening.
// Steps counted from PRs show — without PR data rather than a zero.
export default function Pipeline({ board }: { board: Board }) {
  const f = board.features;
  const k = board.stats.byKind;
  const open = board.lanes.flatMap((l) => l.prs);
  const drafts = open.filter((p) => p.draft && p.kind === "feature").length;
  const done = f.filter((x) => x.state === "done");
  const verified = done.filter((x) => x.verified).length;
  const pr = (n: string) => (board.prsKnown ? n : "—");

  const steps: { name: string; rule: string; n: string; unit: string }[] = [
    { name: "Spec", rule: "Every feature starts as a spec with its dependencies and the paths it alone may change", n: `${f.length}`, unit: "specs" },
    { name: "Claim", rule: "An agent takes the first ready feature and opens a draft PR at once: the draft is the claim", n: pr(`${drafts}`), unit: "drafts open now" },
    { name: "Gate", rule: "CI rejects a PR that touches files its title doesn't own, or lands new features during a freeze", n: pr(`${k.feature ?? 0}`), unit: `feature PRs merged · ${k.fix ?? 0} fixes` },
    { name: "Verify", rule: "The agent drives the real build (Playwright on a production build) and pastes the result", n: `${verified}/${done.length}`, unit: "done notes verified" },
    {
      name: "Merge",
      rule: "Green CI, then the agent squash-merges its own PR. Plans and rule changes wait for a person",
      n: board.stats.medianOpenMin === null ? "—" : `${board.stats.medianOpenMin}m`, // null without PR data
      unit: "median open → merge",
    },
  ];

  return (
    <div className={styles.pipeline}>
      {steps.map((s, i) => (
        <div key={s.name} className={`${styles.panel} ${styles.step}`}>
          <div className={styles.stepNo}>0{i + 1}</div>
          <div className={`${styles.stepName} ${styles.stencil}`}>{s.name}</div>
          <p className={styles.stepRule}>{s.rule}</p>
          <div className={`${styles.stepNum} ${styles.stencil}`} data-testid={`step-${s.name.toLowerCase()}`}>
            {s.n}
          </div>
          <div className={styles.statLabel}>{s.unit}</div>
        </div>
      ))}
      <p className={styles.guard}>
        Guardrails: <b>{k.plan ?? 0}</b> plan PRs and <b>{k.contract ?? 0}</b> contract PRs (scope and frozen-file changes) merged ·{" "}
        <b>{board.stats.reverts}</b> reverts · a STOP file on main halts every agent.
      </p>
    </div>
  );
}
