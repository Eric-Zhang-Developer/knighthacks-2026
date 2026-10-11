import Branches from "@/components/branches";
import Challenge from "@/components/challenge";
import Compare from "@/components/compare";
import Drawer from "@/components/drawer";
import Evidence from "@/components/evidence";
import Galaxy from "@/components/galaxy";
import Idea from "@/components/idea";
import PlanStep from "@/components/plan";
import Revisions from "@/components/revisions";
import Scorecard from "@/components/scorecard";
import Search from "@/components/search";
import Share from "@/components/share";
import Nav from "@/components/shell";
import Sheet from "@/components/shell/Sheet";
import Steps from "@/components/shell/Steps";
import Snapshot from "@/components/snapshot";
import Mentor from "@/components/mentor";
import Votes from "@/components/votes";
import styles from "./page.module.css";

// Each area is owned by one feature (specs/features/*/spec.md); a panel renders nothing until it's relevant.
// Desktop: top bar, discovery rail | galaxy over the composer | contextual rail. Phone: one destination at a time
// (Explore, Talk, Idea, Decide, Plan), picked by <Nav> through html[data-dest] (specs/features/experience-shell).
export default function Home() {
  // Local testing only: the hosted preview is not approved for production data deletion.
  // Never serialize either URL; only this capability boolean crosses the client boundary.
  const deletionAvailable = process.env.NODE_ENV === "development" &&
    !!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
  return (
    <div className={styles.shell}>
      <div className={styles.top}>
        <h1 className={styles.brand}>
          <span className={styles.wordmark}>Uncharted</span>
          <span className={styles.tagline}>Find your next idea.</span>
        </h1>
        <header className={styles.search} aria-label="Search">
          <Search />
        </header>
      </div>
      <main className={styles.map} aria-label="Galaxy">
        {/* The galaxy renders its history, legend and project list into the rail. */}
        <details className={styles.rail}>
          <summary>Browse the map</summary>
          <div id="discovery-rail" className={styles.railControls} />
        </details>
        <div className={styles.chart}>
          <Galaxy />
        </div>
      </main>
      <footer className={styles.composer} aria-label="Voice">
        <Mentor />
      </footer>
      <aside className={styles.side} aria-label="Idea and evidence">
        <div id="mentor-notes" />
        <Steps />
        <Sheet>
          <Drawer />
        </Sheet>
        {/* The idea path in brainstorming order: explore and grow before anything judges the idea (defer
            judgment), then test it, then decide and plan. Each group is one step in the step index. */}
        <div className={styles.ideaPath}>
          <div id="mentor-evidence" />
          <div id="mentor-ideas" />
          <div id="step-idea">
            <Idea deletionAvailable={deletionAvailable} />
          </div>
          <details id="step-explore" className={styles.group}>
            <summary>Explore related projects</summary>
            <Evidence />
          </details>
          <details id="step-grow" className={styles.group}>
            <summary>Refine and compare</summary>
            <Revisions />
            <Branches />
            <Compare />
          </details>
          <details id="step-test" className={styles.group}>
            <summary>Test your assumptions</summary>
            <Scorecard />
            <Challenge />
          </details>
        </div>
        <div id="step-decide" className={styles.decide}>
          {/* Decide's panels render nothing until an idea is saved; the phone says so instead of a blank screen. */}
          <p className={styles.empty}>Save an idea to vote on it, decide, and share it.</p>
          <Votes />
          <Snapshot />
          <Share />
        </div>
        {/* The last step of the flow (Plan 6): its own phone destination, after Decide on desktop. */}
        <div id="step-plan" className={styles.plan}>
          <p className={styles.empty}>Save an idea, then plan its build here.</p>
          <PlanStep />
        </div>
      </aside>
      <Nav />
    </div>
  );
}
