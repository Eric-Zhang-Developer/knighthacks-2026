"use client";

import { useEffect, useState } from "react";
import type { ProjectEvent } from "@/db/schema/corpus";
import { setState, useAppState } from "@/lib/store";
import { ClaimBadge, PanelState } from "@/components/ui";
import { keyOf, useClasses } from "@/lib/classes";
import styles from "./drawer.module.css";

type Project = {
  id: string;
  url: string;
  title: string;
  tagline: string | null;
  description: string;
  technologies: string[];
  events: ProjectEvent[];
  date: string | null;
  dateKind: "created" | "unknown";
};
type Load = { id: string } & ({ state: "loading" } | { state: "missing" } | { state: "error" } | { state: "ready"; project: Project });

const EXCERPT = 400;
const excerpt = (s: string) => (s.length > EXCERPT ? `${s.slice(0, EXCERPT).trimEnd()}…` : s);
const Unknown = ({ what }: { what: string }) => <span className={styles.unknown}>{what} unknown</span>;

// A project with no description is only its Devpost gallery card; say so, so its tagline isn't read as a write-up.
export function Description({ text }: { text: string }) {
  if (text.trim()) return <p className={styles.excerpt}>{excerpt(text)}</p>;
  return <span className={styles.unknown}>Gallery card only: Devpost lists a title and tagline; no description on record</span>;
}

// Opens in the right column whenever a project is selected (galaxy click, list or search).
export default function Drawer() {
  const id = useAppState((s) => s.selectedProjectId);
  const [load, setLoad] = useState<Load | null>(null);

  useEffect(() => {
    if (!id) return;
    const ctrl = new AbortController();
    setLoad({ id, state: "loading" });
    fetch(`/api/projects/${encodeURIComponent(id)}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (r.status === 404) return setLoad({ id, state: "missing" });
        if (!r.ok) return setLoad({ id, state: "error" });
        setLoad({ id, state: "ready", project: (await r.json()) as Project });
      })
      .catch(() => !ctrl.signal.aborted && setLoad({ id, state: "error" }));
    return () => ctrl.abort();
  }, [id]);

  if (!id || !load || load.id !== id) return null;
  const close = (
    <button type="button" className={styles.close} onClick={() => setState({ selectedProjectId: null })}>
      Close
    </button>
  );
  if (load.state !== "ready") {
    const view = {
      loading: { kind: "loading", message: "Loading project…" },
      missing: { kind: "empty", message: "Project not found." },
      error: { kind: "failed", message: "Couldn't load this project." },
    } as const;
    return (
      <section className={`ui-panel ${styles.drawer}`} data-panel="drawer" aria-label="Project">
        <div className={styles.head}>
          <PanelState {...view[load.state]} />
          {close}
        </div>
      </section>
    );
  }

  const p = load.project;
  return (
    <section className={`ui-panel ${styles.drawer}`} data-panel="drawer" aria-label="Project">
      <div className={styles.head}>
        <h2 className="ui-heading">{p.title}</h2>
        {close}
      </div>
      {p.tagline ? <p className={styles.tagline}>{p.tagline}</p> : <Unknown what="tagline" />}
      <dl className={styles.facts}>
        <dt>Event</dt>
        <dd>{p.events.length ? p.events.map((e) => e.name).join(", ") : <Unknown what="event" />}</dd>
        {/* corpus-fetch records when the project page was created, not when it was submitted. */}
        <dt>{p.dateKind === "created" ? "Created" : "Date"}</dt>
        <dd>{p.date ? (/^\d{4}-\d{2}-\d{2}T/.test(p.date) ? p.date.slice(0, 10) : p.date) : <Unknown what="date" />}</dd>
        <dt>Built with</dt>
        <dd>{p.technologies.length ? p.technologies.join(", ") : <Unknown what="technologies" />}</dd>
        <Classified id={p.id} />
      </dl>
      <Description text={p.description} />
      <a className={styles.source} href={p.url} target="_blank" rel="noopener noreferrer">
        Source: {p.url}
      </a>
    </section>
  );
}

const PLACE = ["1st", "2nd", "3rd"];

// The project's inferred category (a model's reading of its text, so labelled inferred) and every prize with its event,
// kind, place and sponsor. Nothing shows until classes.json is loaded for this corpus.
function Classified({ id }: { id: string }) {
  const load = useClasses((s) => s.load);
  if (load.state !== "ready") return null;
  const c = load.data.projects[id];
  if (!c) return null;
  const key = keyOf(c);
  const label = load.data.domains.find((d) => d.id === key)?.label ?? (key === "mixed" ? "Mixed" : "Not enough text to say");
  return (
    <>
      <dt>Category</dt>
      <dd data-category={key}>
        <ClaimBadge label="inferred" /> {label}
        {c.status === "mixed" && c.runner_up && ` (or ${load.data.domains.find((d) => d.id === c.runner_up)?.label ?? c.runner_up})`}
      </dd>
      <dt>Prizes</dt>
      <dd>
        {c.prizes.length ? (
          <ul className={styles.prizes} aria-label="Prizes">
            {c.prizes.map((z, i) => (
              <li key={i} data-kind={z.kind}>
                {z.text}
                <span className={styles.prizeMeta}>
                  {[z.event ?? "event unknown", z.kind, z.place ? PLACE[z.place - 1] : null, z.sponsor].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <span className={styles.unknown}>None listed</span>
        )}
      </dd>
    </>
  );
}
