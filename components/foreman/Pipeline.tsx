import { dur, type Board } from "@/lib/foreman/board";
import { proofFeature } from "@/lib/foreman/charts";
import { clock } from "@/lib/foreman/time";
import styles from "./foreman.module.css";

type Step = { name: string; rule: string; n: string; unit: string; thread: React.ReactNode };

// The judges' story (spec § The story): the loop every agent runs (AGENTS.md), each step with the snapshot's number
// that shows it happening, and one real feature traced through every step underneath. Steps counted from PRs show
// — without PR data rather than a zero; the thread needs a merged feat PR, so it is left out without one.
export default function Pipeline({ board }: { board: Board }) {
  const f = board.features;
  const k = board.stats.byKind;
  const open = board.lanes.flatMap((l) => l.prs);
  const drafts = open.filter((p) => p.draft && p.kind === "feature").length;
  const done = f.filter((x) => x.state === "done");
  const verified = done.filter((x) => x.verified).length;
  const pr = (n: string) => (board.prsKnown ? n : "—");
  const gh = `https://github.com/${board.repo}`;
  const pick = proofFeature(f);
  const t = pick ? f.find((x) => x.slug === pick.slug)! : null;
  const at = (iso: string | null) => (iso ? clock(Date.parse(iso)) : "unknown");

  const steps: Step[] = [
    {
      name: "Spec",
      rule: "Every feature starts as a spec with its dependencies and the paths it alone may change",
      n: `${f.length}`,
      unit: "specs",
      thread: t && (
        <>
          <a href={`${gh}/blob/main/${t.specDir}/spec.md`}>{t.slug}/spec.md</a>
          <span>
            waits on {t.deps.length} · {pick!.n} wait on it
          </span>
        </>
      ),
    },
    {
      name: "Claim",
      rule: "An agent takes the first ready feature and opens a draft PR at once: the draft is the claim",
      n: pr(`${drafts}`),
      unit: "drafts open now",
      thread: t?.builtBy && (
        <>
          <a href={t.builtBy.url}>PR #{t.builtBy.number}</a>
          <span>
            {t.worker ?? "unnamed"} · opened {at(t.startedAt)}
          </span>
        </>
      ),
    },
    {
      name: "Gate",
      rule: "CI rejects a PR that touches files its title doesn't own, or lands new features during a freeze",
      n: pr(`${k.feature ?? 0}`),
      unit: `feature PRs merged · ${k.fix ?? 0} fixes`,
      thread: t?.builtBy && (
        <>
          <a href={`${t.builtBy.url}/checks`}>checks on #{t.builtBy.number}</a>
          <span>the checks it merged through</span>
        </>
      ),
    },
    {
      name: "Verify",
      rule: "The agent drives the real build (Playwright on a production build) and pastes the result",
      n: `${verified}/${done.length}`,
      unit: "done notes verified",
      thread: t && (
        <>
          <a href={`${gh}/blob/main/changes/${t.slug}.md`}>changes/{t.slug}.md</a>
          <span>{t.verified ? "verify: pass" : "not verified: the note says why"}</span>
        </>
      ),
    },
    {
      name: "Merge",
      rule: "Green CI, then the agent squash-merges its own PR. Plans and rule changes wait for a person",
      n: board.stats.medianOpenMin === null ? "—" : `${board.stats.medianOpenMin}m`, // null without PR data
      unit: "median open → merge",
      thread: t && (
        <>
          <b>merged {at(t.doneAt)}</b>
          <span>{t.buildMin !== null ? `built in ${dur(t.buildMin)}, first PR to merge` : "build time unknown"}</span>
        </>
      ),
    },
    {
      name: "Live",
      rule: "Every merge to main deploys. Follow-up fixes go through the same loop, scoped to the feature",
      n: pr(`${board.stats.merged}`),
      unit: "merges to main",
      thread: t && (
        <>
          <a href={`${gh}/commit/${board.sha}`}>main @ {board.sha.slice(0, 7)}</a>
          <span>
            {Math.max(0, t.prs - 1)} more PR{t.prs - 1 === 1 ? "" : "s"} on it since
          </span>
        </>
      ),
    },
  ];

  return (
    <div className={styles.pipeline}>
      {t && (
        <p className={styles.threadHead} data-testid="thread">
          <i aria-hidden />
          <span>
            One real feature, followed through every step: <b>{t.slug}</b>, {t.name.charAt(0).toLowerCase() + t.name.slice(1)}
          </span>
        </p>
      )}
      {steps.map((s, i) => (
        <div key={s.name} className={`${styles.panel} ${styles.step}`}>
          <div className={styles.stepNo}>0{i + 1}</div>
          <div className={`${styles.stepName} ${styles.stencil}`}>{s.name}</div>
          <p className={styles.stepRule}>{s.rule}</p>
          <div className={`${styles.stepNum} ${styles.stencil}`} data-testid={`step-${s.name.toLowerCase()}`}>
            {s.n}
          </div>
          <div className={styles.statLabel}>{s.unit}</div>
          {s.thread && <div className={styles.thread}>{s.thread}</div>}
        </div>
      ))}
      <p className={styles.guard}>
        Guardrails: <b>{pr(`${k.plan ?? 0}`)}</b> plan PRs and <b>{pr(`${k.contract ?? 0}`)}</b> contract PRs (scope and frozen-file changes) merged ·{" "}
        <b>{pr(`${board.stats.reverts}`)}</b> reverts · a STOP file on main halts every agent.
      </p>
    </div>
  );
}
