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
      <header className={styles.rail} aria-label="Discovery">
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden>
            U
          </span>
          <span>
            <strong>Uncharted</strong>
            <small>Map the field</small>
          </span>
        </div>
        <nav className={styles.nav} aria-label="Primary">
          <a href="#galaxy">Galaxy</a>
          <a href="#workspace">Idea</a>
          <a href="#live-talk">Talk</a>
        </nav>
        <div className={styles.discovery}>
          <p className={styles.eyebrow}>Discover</p>
          <h1>Explore what has already been built.</h1>
          <p>Search real projects, inspect their sources, then place your idea among its nearest neighbors.</p>
        </div>
        <div className={styles.search} aria-label="Search">
          <Search />
        </div>
        <p className={styles.railNote}>Distance on this map is approximate. Evidence stays in the source panels.</p>
      </header>
      <main className={styles.map} id="galaxy" aria-label="Galaxy" tabIndex={-1}>
        <div className={styles.mapTitle} aria-hidden>
          <span>Project galaxy</span>
          <span>Drag to explore · Select a star for evidence</span>
        </div>
        <Galaxy />
        <Explainer />
      </main>
      <aside className={styles.side} id="workspace" aria-label="Idea and evidence">
        <details className={styles.sheet} open>
          <summary>
            <span>
              <strong>Idea &amp; evidence</strong>
              <small>Claims stay labelled by confidence</small>
            </span>
            <span className={styles.sheetAction}>Show / hide</span>
          </summary>
          <div className={styles.sideScroll}>
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
          </div>
        </details>
      </aside>
      <footer className={styles.bottom} id="live-talk" aria-label="Voice">
        <Voice />
      </footer>
    </div>
  );
}
