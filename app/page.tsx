import Branches from "@/components/branches";
import Challenge from "@/components/challenge";
import Compare from "@/components/compare";
import Drawer from "@/components/drawer";
import Evidence from "@/components/evidence";
import Explainer from "@/components/explainer";
import Galaxy from "@/components/galaxy";
import Idea from "@/components/idea";
import PlanStep from "@/components/plan";
import Revisions from "@/components/revisions";
import Scorecard from "@/components/scorecard";
import Search from "@/components/search";
import Share from "@/components/share";
import Nav from "@/components/shell";
import Sheet from "@/components/shell/Sheet";
import Starters from "@/components/shell/Starters";
import Steps from "@/components/shell/Steps";
import Tabs from "@/components/shell/Tabs";
import Snapshot from "@/components/snapshot";
import Voice from "@/components/voice";
import Votes from "@/components/votes";
import styles from "./page.module.css";

// Each area is owned by one feature (specs/features/*/spec.md); a panel renders nothing until it's relevant.
// Desktop: top bar (Explore / Build), discovery rail | galaxy over the search-and-voice dock | contextual rail; Build
// gives the contextual rail the stage. Phone: one destination at a time
// (Explore, Talk, Idea, Decide, Plan), picked by <Nav> through html[data-dest] (specs/features/experience-shell).
export default function Home() {
  return (
    <div className={styles.shell}>
      {/* The header is navigation only (specs/features/header-nav): the wordmark, Explore / Build, and the workspace
          (app/layout.tsx mounts it over the header's right end). */}
      <header className={styles.top}>
        <p className={styles.wordmark}>Uncharted</p>
        <Tabs />
      </header>
      {/* The dock under the map: search with its filters, then push-to-talk. First in tab order after the header. */}
      <div className={styles.dock}>
        <section className={styles.search} aria-label="Search">
          <Search />
        </section>
        <footer className={styles.composer} aria-label="Voice">
          <Voice />
        </footer>
      </div>
      <main className={styles.map} aria-label="Galaxy">
        {/* The galaxy renders its history, legend and project list into the rail. */}
        <div className={styles.rail}>
          <div id="discovery-rail" className={styles.railControls} />
          <div className={styles.explain}>
            <Explainer />
          </div>
        </div>
        <div className={styles.chart}>
          <Galaxy />
        </div>
      </main>
      <aside className={styles.side} aria-label="Idea and evidence">
        <Steps />
        <Sheet>
          <Drawer />
        </Sheet>
        {/* The idea path in brainstorming order: explore and grow before anything judges the idea (defer
            judgment), then test it, then decide and plan. Each group is one step in the step index. */}
        <div className={styles.ideaPath}>
          <div id="step-idea">
            <Idea />
            <Starters />
          </div>
          <div id="step-explore">
            <Evidence />
          </div>
          <div id="step-grow">
            <Revisions />
            <Branches />
            <Compare />
          </div>
          <div id="step-test">
            <Scorecard />
            <Challenge />
          </div>
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
