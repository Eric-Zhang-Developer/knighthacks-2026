import styles from "./mentor.module.css";

export type MentorProject = { projectId: string; title: string; url: string; excerpt: string };

export default function EvidenceCards({ projects, onInspect }: { projects: MentorProject[]; onInspect: (id: string) => void }) {
  if (!projects.length) return null;
  return <section className={styles.sources} aria-label="Conversation sources">
    <h3>Related projects</h3>
    <p className={styles.fine}>Latest conversation search. These sources support comparison, not a verdict that your idea is original or already solved.</p>
    {projects.map((project) => <article key={project.projectId}>
      <strong>{project.title}</strong>
      <p>{project.excerpt || "No excerpt available. Open the source for details."}</p>
      <button type="button" onClick={() => onInspect(project.projectId)}>Inspect project</button>
      {/^https?:\/\//.test(project.url) && <a href={project.url} target="_blank" rel="noopener noreferrer">View source ↗</a>}
    </article>)}
  </section>;
}
