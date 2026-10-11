import { PanelState } from "@/components/ui";
import styles from "./votes.module.css";

// The vote API exposes no member count (a teammate's presence isn't revealed either), so the hint is worded to be
// true both when nobody has joined yet and when a joined teammate just hasn't voted (#220).
export default function Waiting() {
  return (
    <>
      <PanelState kind="loading" message="Waiting for your teammate to vote." />
      <p className={styles.meta} data-hint="invite">
        Both teammates must vote before either vote is shown. No teammate yet? Send them a link with Invite a teammate.
      </p>
    </>
  );
}
