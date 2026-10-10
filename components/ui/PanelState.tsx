import styles from "./ui.module.css";

export type PanelStateKind = "loading" | "empty" | "partial" | "failed" | "offline";

const DEFAULT: Record<PanelStateKind, string> = {
  loading: "Loading…",
  empty: "Nothing here yet.",
  partial: "Some of this is unavailable.",
  failed: "Something went wrong.",
  offline: "You're offline.",
};
// A glyph per kind, so no state relies on colour alone.
const GLYPH: Record<PanelStateKind, string> = { loading: "…", empty: "∅", partial: "◐", failed: "!", offline: "⌁" };

export function PanelState({ kind, message, onRetry }: { kind: PanelStateKind; message?: string; onRetry?: () => void }) {
  const urgent = kind === "failed" || kind === "offline";
  return (
    <div className={styles.state} data-kind={kind} role={urgent ? "alert" : "status"}>
      <span className={styles.glyph} aria-hidden>
        {GLYPH[kind]}
      </span>
      <p>{message ?? DEFAULT[kind]}</p>
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
