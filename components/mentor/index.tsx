"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { FIELDS, type Fields, type Version } from "@/components/idea/fields";
import { QUESTION_FIELDS, withAnswers, type Answer, type Question, type Round } from "@/components/interview/interview";
import { initWorkspace } from "@/components/workspace/api";
import { getState, setState } from "@/lib/store";
import type { LiveControls } from "./Live";
import { readFields, request } from "./protocol";
import styles from "./mentor.module.css";

const Live = dynamic(() => import("./Live"), { ssr: false, loading: () => <p>Loading conversation controls…</p> });
type Message = { role: "user" | "mentor"; text: string };
type Project = { projectId: string; title: string; url: string; excerpt: string };

export default function Mentor() {
  const [open, setOpen] = useState(false);
  const [loadVoice, setLoadVoice] = useState(false);
  const [voiceState, setVoiceState] = useState("Text ready");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [proposal, setProposal] = useState<Fields | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const initial = useRef("");
  const answers = useRef<Answer[]>([]);
  const saveKey = useRef("");
  const lock = useRef(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const live = useRef<LiveControls | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const show = () => { setOpen(true); setLoadVoice(true); };
    const hash = () => { if (location.hash === "#talk") show(); };
    window.addEventListener("mentor:open", show);
    window.addEventListener("hashchange", hash);
    hash();
    const token = generation;
    return () => { window.removeEventListener("mentor:open", show); window.removeEventListener("hashchange", hash); controller.current?.abort(); token.current++; };
  }, []);
  useEffect(() => { if (open) textarea.current?.focus(); }, [open]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "instant" }); }, [messages, busy]);

  function message(role: Message["role"], text: string) { setMessages((old) => [...old, { role, text }]); }
  function proposed(fields: Fields) { if (lock.current) return; setProposal(fields); setSaved(false); saveKey.current = crypto.randomUUID(); }
  function close() { setOpen(false); launcher.current?.focus(); }
  function navigate(destination: string) {
    location.hash = destination;
    close();
  }

  async function send() {
    const text = input.trim();
    if (!text || lock.current) return;
    if (voiceState === "Connecting") { setError("Wait for the connection or end it to continue by text."); return; }
    if (live.current) { live.current.send(text); setInput(""); return; }
    lock.current = true; setBusy(true); setError(""); setSaved(false);
    const id = ++generation.current;
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const nextAnswers = question ? [...answers.current, { question: question.question, field: question.field, answer: text }] : answers.current;
    const nextInitial = !initial.current ? text : question ? initial.current : `${initial.current}\nCorrection or additional context: ${text}`;
    const context = withAnswers(nextInitial, nextAnswers);
    try {
      if (context.length > 8000) throw new Error("This draft has reached its text limit. Review it or start a new conversation; your text is kept.");
      const workspace = await initWorkspace();
      if (!workspace.ok) throw new Error("Your workspace could not start. Your message is kept; please retry.");
      if (id !== generation.current) return;
      const fields = readFields(await request("/api/ideas/interpret", { text: context }, abort.signal));
      if (id !== generation.current) return;
      initial.current = nextInitial; answers.current = nextAnswers;
      setState({ ideaDraft: context }); setInput(""); message("user", text);
      setProposal(fields); saveKey.current = crypto.randomUUID();
      // The API remains the authority for the interview's bounded answer policy.
      const response = await request("/api/ideas/questions", { fields, answers: nextAnswers }, abort.signal) as Round;
      if (id !== generation.current) return;
      const next = !response.done && Array.isArray(response.questions) ? response.questions.find((q) => QUESTION_FIELDS.includes(q.field) && typeof q.question === "string") : null;
      setQuestion(next ?? null);
      message("mentor", next ? next.question : "The draft is ready to review. What would you change, or would you like to explore related projects? Nothing has been saved.");
    } catch (failure) {
      if (id === generation.current && !abort.signal.aborted) { setQuestion(null); setError(failure instanceof Error ? failure.message : "That request failed. Your message is kept."); }
    } finally { if (id === generation.current) { lock.current = false; setBusy(false); } }
  }

  async function save() {
    if (!proposal || lock.current || saved) return;
    lock.current = true; setBusy(true); setError("");
    live.current?.end();
    const fields = { ...proposal };
    try {
      const workspace = await initWorkspace();
      if (!workspace.ok) throw new Error("Your workspace could not start. Please retry.");
      const version = await request("/api/ideas", fields, undefined, { "Idempotency-Key": saveKey.current }) as Version;
      if (!version?.versionId || !Array.isArray(version.neighborIds)) throw new Error("The save response was incomplete. Retry uses the same save key.");
      setState({ ideaStars: [...getState().ideaStars.filter((s) => s.versionId !== version.versionId), { versionId: version.versionId, x: version.x, y: version.y, z: version.z }], activeIdeaVersionId: version.versionId, highlightedIds: version.neighborIds, ideaDraft: "" });
      window.dispatchEvent(new CustomEvent("mentor:saved", { detail: version }));
      setSaved(true); setQuestion(null);
      message("mentor", "Saved as a new idea. You can now inspect its evidence, refine it, or make a decision with your teammate.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Save failed. Your proposal is kept."); }
    finally { lock.current = false; setBusy(false); }
  }

  const activeAudio = ["Listening", "Speaking", "Connecting"].includes(voiceState);
  return <div className={styles.host}>
    <section className={styles.panel} hidden={!open} aria-label="Brainstorm conversation" onKeyDown={(event) => { if (event.key === "Escape") close(); }}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>UNCHARTED</span><h2>Let’s think it through.</h2></div>
        <button type="button" className={styles.close} aria-label="Minimize conversation" onClick={close}>×</button>
      </header>
      <div className={styles.scroll} ref={log}>
        <p className={styles.intro}>Start with a problem, not a perfect pitch. We’ll explore who it helps, what could fail, and what to test.</p>
        <div className={styles.audio}>
          {!loadVoice ? <><button type="button" onClick={() => setLoadVoice(true)}>Talk live with ElevenLabs</button><p>Or type below. No microphone needed.</p></> : <Live onMessage={message} onProposal={proposed} onEvidence={setProjects} onState={setVoiceState} onControls={(controls) => { live.current = controls; }} />}
        </div>
        <div role="log" aria-label="Conversation transcript" aria-live="polite">
          {messages.map((item, index) => <div key={index} className={item.role === "user" ? styles.user : styles.reply}><span>{item.role === "user" ? "You" : "Uncharted"}</span><p>{item.text}</p></div>)}
        </div>
        {projects.length > 0 && <section className={styles.sources} aria-label="Conversation sources"><h3>Related projects</h3>{projects.map((project) => <article key={project.projectId}><strong>{project.title}</strong><p>{project.excerpt}</p>{/^https?:\/\//.test(project.url) && <a href={project.url} target="_blank" rel="noopener noreferrer">View source ↗</a>}</article>)}</section>}
        {proposal && <section className={styles.proposal} aria-label="Idea proposal"><span className={styles.eyebrow}>{saved ? "SAVED" : "UNSAVED DRAFT"}</span><h3>{proposal.title || "Your emerging idea"}</h3><p>{proposal.description || proposal.problem || "Some details are still unknown."}</p>
          <details><summary>Edit details (optional)</summary>{FIELDS.map(({name,label}) => <label key={name}>{label}<textarea disabled={busy || saved} value={proposal[name] ?? ""} onChange={(event) => { setProposal({ ...proposal, [name]: event.target.value || null }); saveKey.current = crypto.randomUUID(); }} /></label>)}</details>
          {!saved && <button type="button" disabled={busy} onClick={save}>Save as new idea</button>}
          <p className={styles.fine}>Saving creates a separate idea. It does not revise an existing one.</p>
        </section>}
        {busy && <p role="status">Thinking through your idea…</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {(messages.length >= 2 || saved) && <div className={styles.next}><button type="button" onClick={() => navigate("explore")}>Explore the map</button>{saved && <button type="button" onClick={() => navigate("idea")}>See evidence</button>}<button type="button" onClick={() => { close(); const team = document.querySelector<HTMLDetailsElement>('details[aria-label="Workspace"]'); if (team) { team.open = true; team.querySelector<HTMLElement>("summary")?.focus(); } }}>Add a teammate</button></div>}
      </div>
      <form className={styles.compose} onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <textarea ref={textarea} aria-label="Message Uncharted" placeholder="What are you thinking about?" maxLength={8000} rows={2} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send message">↑</button>
      </form>
      <div className={styles.status} role="status">{voiceState}{activeAudio && <button type="button" onClick={() => live.current?.end()}>End conversation</button>}</div>
    </section>
    <button ref={launcher} className={styles.bubble} type="button" aria-label={open ? "Minimize conversation" : "Open conversation"} aria-expanded={open} onClick={() => { if (open) close(); else { setOpen(true); setLoadVoice(true); } }}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 12v8m6-14v20m6-17v14m6-11v8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
    </button>
    <span className={styles.caption}>{activeAudio ? voiceState : "Let’s brainstorm"}</span>
    {!open && activeAudio && <button className={styles.end} type="button" onClick={() => { live.current?.end(); if (voiceState === "Connecting") setOpen(true); }}>End conversation</button>}
  </div>;
}
