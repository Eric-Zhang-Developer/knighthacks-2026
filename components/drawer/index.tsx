"use client";

import { useEffect, useState } from "react";
import type { ProjectEvent } from "@/db/schema/corpus";
import { setState, useAppState } from "@/lib/store";
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
    const message = { loading: "Loading project…", missing: "Project not found.", error: "Couldn't load this project." };
    return (
      <section className={styles.drawer} aria-label="Project">
        <div className={styles.head}>
          <p role="status">{message[load.state]}</p>
          {close}
        </div>
      </section>
    );
  }

  const p = load.project;
  return (
    <section className={styles.drawer} aria-label="Project">
      <div className={styles.head}>
        <h2 className={styles.title}>{p.title}</h2>
        {close}
      </div>
      {p.tagline ? <p className={styles.tagline}>{p.tagline}</p> : <Unknown what="tagline" />}
      <dl className={styles.facts}>
        <dt>Event</dt>
        <dd>{p.events.length ? p.events.map((e) => e.name).join(", ") : <Unknown what="event" />}</dd>
        {/* corpus-fetch records when the project page was created, not when it was submitted. */}
        <dt>{p.dateKind === "created" ? "Created" : "Date"}</dt>
        <dd>{p.date ?? <Unknown what="date" />}</dd>
        <dt>Built with</dt>
        <dd>{p.technologies.length ? p.technologies.join(", ") : <Unknown what="technologies" />}</dd>
      </dl>
      {p.description ? <p className={styles.excerpt}>{excerpt(p.description)}</p> : <Unknown what="description" />}
      <a className={styles.source} href={p.url} target="_blank" rel="noopener noreferrer">
        Source: {p.url}
      </a>
    </section>
  );
}
