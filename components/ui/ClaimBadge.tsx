import styles from "./ui.module.css";

export type ClaimLabel = "supported" | "inferred" | "unverified";

// supported: cites a stored source; inferred: reasoned from sources; unverified: no source (specs/mission.md).
const SHAPE: Record<ClaimLabel, string> = { supported: "●", inferred: "◆", unverified: "○" };

export function ClaimBadge({ label }: { label: ClaimLabel }) {
  return (
    <span className={styles.badge} data-label={label}>
      <span aria-hidden>{SHAPE[label]}</span>
      {label}
    </span>
  );
}
