import Branches from "@/components/branches";
import Challenge from "@/components/challenge";
import Compare from "@/components/compare";
import Drawer from "@/components/drawer";
import Evidence from "@/components/evidence";
import Explainer from "@/components/explainer";
import Galaxy from "@/components/galaxy";
import Idea from "@/components/idea";
import Revisions from "@/components/revisions";
import Search from "@/components/search";
import Share from "@/components/share";
import Snapshot from "@/components/snapshot";
import Voice from "@/components/voice";
import Votes from "@/components/votes";
import styles from "./page.module.css";

// Each area is owned by one feature (specs/features/*/spec.md); a panel renders nothing until it's relevant.
export default function Home() {
  return (
    <div className={styles.shell}>
      <div className={styles.top}>
        <p className={styles.brand}>
          <span className={styles.wordmark}>Uncharted</span>
          <span className={styles.tagline}>a star chart of hackathon ideas</span>
        </p>
        <header className={styles.search} aria-label="Search">
          <Search />
        </header>
      </div>
      <main className={styles.map} aria-label="Galaxy">
        <Galaxy />
        <Explainer />
      </main>
      <aside className={styles.side} aria-label="Idea and evidence">
        <Idea />
        <Drawer />
        <Evidence />
        <Revisions />
        <Challenge />
        <Branches />
        <Compare />
        <Votes />
        <Snapshot />
        <Share />
      </aside>
      <footer className={styles.bottom} aria-label="Voice">
        <Voice />
      </footer>
    </div>
  );
}
