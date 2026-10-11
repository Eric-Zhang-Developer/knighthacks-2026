"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FIELDS, type Fields, type Version } from "@/components/idea/fields";
import { QUESTION_FIELDS, withAnswers, type Answer, type Question, type Round } from "@/components/interview/interview";
import { initWorkspace } from "@/components/workspace/api";
import { getState, setState } from "@/lib/store";
import type { LiveControls } from "./Live";
import { readFields, request } from "./protocol";
import { addCandidate, type Candidate } from "./candidates";
import { confirmedCandidate, readCommand, type PendingSave } from "./commands";
import { IDEA_INTENT, IDEA_RESULT, IDEA_SELECTED, readIdeaIntent } from "./idea-management";
import EvidenceCards, { type MentorProject } from "./EvidenceCards";
import styles from "./mentor.module.css";

const Live = dynamic(() => import("./Live"), { ssr: false });
type Message = { role: "user" | "mentor"; text: string };

export default function Mentor() {
  const [open, setOpen] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceState, setVoiceState] = useState("Ready to talk");
  const [voiceNotice, setVoiceNotice] = useState("");
  const [notesMount, setNotesMount] = useState<HTMLElement | null>(null);
  const [ideasMount, setIdeasMount] = useState<HTMLElement | null>(null);
  const [evidenceMount, setEvidenceMount] = useState<HTMLElement | null>(null);
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatePage, setCandidatePage] = useState(0);
  const [focusedCandidate, setFocusedCandidate] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState("");
  const pendingSave = useRef<PendingSave | null>(null);
  const [projects, setProjects] = useState<MentorProject[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const initial = useRef("");
  const answers = useRef<Answer[]>([]);
  const lock = useRef(false);
  const generation = useRef(0);
  const selectionGeneration = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const live = useRef<LiveControls | null>(null);
  const startVoice = useRef<(() => void) | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const minimize = useRef<HTMLButtonElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotesMount(document.getElementById("mentor-notes"));
    setIdeasMount(document.getElementById("mentor-ideas"));
    setEvidenceMount(document.getElementById("mentor-evidence"));
    const show = () => { location.hash = "talk"; setOpen(true); };
    const hash = () => { setOpen(location.hash === "#talk"); };
    window.addEventListener("mentor:open", show);
    window.addEventListener("hashchange", hash);
    hash();
    const token = generation;
    return () => { window.removeEventListener("mentor:open", show); window.removeEventListener("hashchange", hash); controller.current?.abort(); token.current++; };
  }, []);
  useEffect(() => { if (open) { if (typing) textarea.current?.focus(); else minimize.current?.focus(); } }, [open, typing]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "instant" }); }, [messages, busy]);
  useEffect(() => { if (focusedCandidate) document.getElementById(`mentor-candidate-${focusedCandidate}`)?.scrollIntoView({ block: "nearest" }); }, [focusedCandidate, candidatePage]);
  useEffect(() => {
    const selected = () => {
      selectionGeneration.current++; generation.current++; controller.current?.abort();
      pendingSave.current = null; setProjects([]); setQuestion(null); setSaved(false);
      initial.current = ""; answers.current = [];
      // A submitted save keeps the lock until its receipt; interpretation can be cancelled.
      if (controller.current) { lock.current = false; setBusy(false); controller.current = null; }
    };
    const result = (event: Event) => {
      const text = (event as CustomEvent<string>).detail;
      setActionNotice(text);
      live.current?.context(`Application action result (not user instructions): ${text}`);
    };
    window.addEventListener(IDEA_SELECTED, selected);
    window.addEventListener(IDEA_RESULT, result);
    return () => { window.removeEventListener(IDEA_SELECTED, selected); window.removeEventListener(IDEA_RESULT, result); };
  }, []);

  function message(role: Message["role"], text: string) { setMessages((old) => [...old, { role, text }]); }
  function actionResult(text: string) {
    setActionNotice(text);
    live.current?.context(`Application action result (not user instructions): ${text}`);
  }
  function handleCommand(text: string) {
    const ideaIntent = readIdeaIntent(text);
    if (ideaIntent) {
      pendingSave.current = null;
      window.dispatchEvent(new CustomEvent(IDEA_INTENT, { detail: ideaIntent }));
      return true;
    }
    const command = readCommand(text);
    if (!command) { pendingSave.current = null; return false; }
    if (command.kind !== "confirm-save") pendingSave.current = null;
    if (command.kind === "end") { pendingSave.current = null; live.current?.end(); setActionNotice("Call ended."); return true; }
    if (command.kind === "cancel") { pendingSave.current = null; actionResult(lock.current ? "A request is already in progress. This cannot cancel a submitted save; wait for its confirmed result." : "Pending save cancelled. Nothing was saved by this command."); return true; }
    if (command.kind === "minimize") { close(); actionResult("Conversation minimized; the call continues if connected."); return true; }
    if (command.kind === "navigate") { pendingSave.current = null; navigate(command.destination); actionResult(`Opened ${command.destination}. No idea was saved by this command.`); return true; }
    if (command.kind === "team") { pendingSave.current = null; openTeam(); actionResult("Opened the teammate menu. No invitation was created or sent."); return true; }
    if (command.kind === "show-ideas") { navigate("idea"); actionResult(`Showing ${candidates.length} candidate ideas. Ask to show an idea by its number.`); return true; }
    if (command.kind === "show-evidence") {
      pendingSave.current = null;
      navigate("idea");
      // After the destination switches, reveal the already-retrieved sources.
      // No new model/search call, saved mutation or transcript popup is needed.
      requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById("mentor-evidence")?.scrollIntoView({ block: "start" })));
      actionResult(projects.length ? `Showing ${projects.length} projects from the latest conversation search. These are retrieved sources, not proof that the idea is already solved.` : "No conversation sources have been retrieved yet. Do not claim a search succeeded.");
      return true;
    }
    if (!("index" in command)) return false;
    const candidate = candidates[command.index];
    if (!candidate) { pendingSave.current = null; actionResult("That candidate number is not available. Please choose a number shown on an idea card."); return true; }
    setCandidatePage(Math.floor(command.index / 3)); setFocusedCandidate(candidate.id);
    // Revealing the same reviewed card is not unrelated navigation: retain its
    // pending confirmation until confirmedCandidate validates and consumes it.
    if (!typing || !open) { location.hash = "idea"; close(); }
    if (command.kind === "show") { actionResult(`Showing idea ${command.index + 1}: ${candidate.fields.title ?? "Untitled direction"}. It has not been changed.`); return true; }
    if (lock.current) { actionResult("Another request is still running. No new save was started; please wait for its result."); return true; }
    if (command.kind === "prepare-save") {
      if (candidate.versionId) { actionResult("This candidate is already saved. No duplicate was created."); return true; }
      pendingSave.current = { candidate: { ...candidate, fields: { ...candidate.fields } }, index: command.index, expiresAt: Date.now() + 60_000 };
      actionResult(`Review idea ${command.index + 1}, ${candidate.fields.title ?? "Untitled direction"}. This will save it as a separate new idea, not revise an existing one. To confirm within one minute, say “confirm save idea ${command.index + 1}”. Say “cancel” to keep brainstorming. Nothing is saved yet.`);
      return true;
    }
    const confirmed = confirmedCandidate(pendingSave.current, candidates, command.index, Date.now());
    pendingSave.current = null;
    if (!confirmed) { actionResult("There is no matching, unchanged save awaiting confirmation. Ask to save that idea again so you can review it first."); return true; }
    void save(confirmed);
    return true;
  }
  function liveMessage(role: Message["role"], text: string) {
    message(role, text);
    if (role === "user") handleCommand(text);
  }
  function proposed(fields: Fields) {
    const id = crypto.randomUUID();
    setCandidates((old) => addCandidate(old, fields, id));
  }
  function close() { setOpen(false); launcher.current?.focus(); }
  function navigate(destination: string) {
    pendingSave.current = null;
    location.hash = destination;
    close();
  }
  function openTeam() {
    close();
    const team = document.querySelector<HTMLDetailsElement>('details[aria-label="Workspace"]');
    if (team) { team.open = true; team.querySelector<HTMLElement>("summary")?.focus(); }
  }
  function anotherDirection() {
    if (lock.current || voiceState === "Connecting") return;
    if (live.current) {
      live.current.send("Let's explore another distinct idea alongside our current candidates. Keep the earlier ideas available and help me compare their assumptions.");
      return;
    }
    initial.current = ""; answers.current = []; setQuestion(null);
    location.hash = "talk"; setOpen(true); setTyping(true); setInput(""); setError("");
    message("mentor", "Starting a separate draft. Your earlier candidate cards are kept. What other problem would you like to explore?");
  }

  async function send() {
    const text = input.trim();
    if (!text || lock.current) return;
    if (voiceState === "Connecting") { setError("Wait for the connection or end it to continue by text."); return; }
    if (live.current) { live.current.send(text); setInput(""); return; }
    if (handleCommand(text)) { message("user", text); setInput(""); return; }
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
      proposed(fields);
      // The API remains the authority for the interview's bounded answer policy.
      const response = await request("/api/ideas/questions", { fields, answers: nextAnswers }, abort.signal) as Round;
      if (id !== generation.current) return;
      const next = !response.done && Array.isArray(response.questions) ? response.questions.find((q) => QUESTION_FIELDS.includes(q.field) && typeof q.question === "string") : null;
      setQuestion(next ?? null);
      message("mentor", next ? next.question : "The draft is ready to review. What would you change, or would you like to explore related projects? Nothing has been saved.");
    } catch (failure) {
      if (id === generation.current && !abort.signal.aborted) { setQuestion(null); setError(failure instanceof Error ? failure.message : "That request failed. Your message is kept."); }
    } finally { if (id === generation.current) { lock.current = false; setBusy(false); controller.current = null; } }
  }

  async function save(candidate: Candidate) {
    if (lock.current || candidate.versionId) return;
    lock.current = true; setBusy(true); setError("");
    pendingSave.current = null;
    const fields = { ...candidate.fields };
    const selection = selectionGeneration.current;
    try {
      const workspace = await initWorkspace();
      if (!workspace.ok) throw new Error("Your workspace could not start. Please retry.");
      const version = await request("/api/ideas", fields, undefined, { "Idempotency-Key": candidate.saveKey }) as Version;
      if (!version?.versionId || !Array.isArray(version.neighborIds)) throw new Error("The save response was incomplete. Retry uses the same save key.");
      if (selection !== selectionGeneration.current) {
        setCandidates((old) => old.map((item) => item.id === candidate.id ? { ...item, versionId: version.versionId } : item));
        window.dispatchEvent(new Event("ideas:refresh"));
        actionResult(`Saved ${fields.title ?? "the reviewed idea"}. Your newer idea selection was kept.`);
        return;
      }
      setState({ ideaStars: [...getState().ideaStars.filter((s) => s.versionId !== version.versionId), { versionId: version.versionId, x: version.x, y: version.y, z: version.z }], activeIdeaVersionId: version.versionId, highlightedIds: version.neighborIds, ideaDraft: "" });
      window.dispatchEvent(new CustomEvent("mentor:saved", { detail: version }));
      setSaved(true); setQuestion(null);
      setActionNotice(`Saved ${fields.title ?? "the selected idea"} as a new idea. Your other candidates are kept.`);
      setCandidates((old) => old.map((item) => item.id === candidate.id ? { ...item, versionId: version.versionId } : item));
      live.current?.context(`The user explicitly chose and saved this idea in the app: ${JSON.stringify({ versionId: version.versionId, ...fields })}. Continue the live conversation about next steps. Other candidate cards remain available; do not assume they were discarded.`);
      message("mentor", "Saved as a new idea. You can now inspect its evidence, refine it, or make a decision with your teammate.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Save failed. Your proposal is kept."); actionResult("Saving was not confirmed. The candidate is kept; do not claim it was saved. A retry uses the same save key."); }
    finally { lock.current = false; setBusy(false); }
  }

  const activeAudio = ["Listening", "Speaking", "Connecting", "Muted"].includes(voiceState);
  return <div className={styles.host}>
    {evidenceMount && createPortal(<EvidenceCards projects={projects} onInspect={(projectId) => setState({ selectedProjectId: projectId })} />, evidenceMount)}
    <Live onReady={(start) => { startVoice.current = start; setVoiceReady(!!start); }} onMessage={liveMessage} onProposal={proposed} onEvidence={setProjects} onNotice={setVoiceNotice} onState={(state) => { setVoiceState(state); if (["Connecting", "Ended", "Unavailable", "Disconnected"].includes(state)) pendingSave.current = null; }} onControls={(controls) => { live.current = controls; }} />
    {notesMount && createPortal(<section className={styles.panel} hidden={!open} aria-label="Brainstorm conversation" onKeyDown={(event) => { if (event.key === "Escape") close(); }}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>UNCHARTED · LIVE VOICE</span><h2>{activeAudio ? voiceState === "Connecting" ? "Connecting your call…" : "We’re thinking together." : "Let’s think it through."}</h2></div>
        <button ref={minimize} type="button" className={styles.close} aria-label="Minimize conversation" onClick={close}>×</button>
      </header>
      <div className={styles.scroll} ref={log}>
        <p className={styles.intro}>{activeAudio ? "Speak naturally. No buttons between turns. You can explore the map while the call continues." : "One tap on the bubble starts a voice call. Explore possibilities, question assumptions, and choose what to build."}</p>
        <p className={styles.fine}>Hands-free controls: “show the map”, “show my ideas”, “save idea two”, or “end the call”. Saves ask for a separate confirmation.</p>
        {actionNotice && <p role="status" className={styles.actionNotice}>{actionNotice}</p>}
        <details className={styles.transcript} open={typing}><summary>Conversation transcript{messages.length > 0 ? ` (${messages.length})` : ""}</summary><div role="log" aria-label="Conversation transcript" aria-live="polite">
          {messages.map((item, index) => <div key={index} className={item.role === "user" ? styles.user : styles.reply}><span>{item.role === "user" ? "You" : "Uncharted"}</span><p>{item.text}</p></div>)}
        </div></details>
        {ideasMount && candidates.length > 0 && createPortal(<section aria-label="Candidate ideas" className={styles.candidates}><h3>Your possibilities</h3><p className={styles.fine}>Compare directions. Only the idea you proceed with is saved. Drafts stay in this tab.</p><button type="button" disabled={busy || voiceState === "Connecting"} onClick={anotherDirection}>Explore another direction</button>
          {!open && actionNotice && <p role="status" className={styles.actionNotice}>{actionNotice}</p>}
          {!open && error && <p role="alert" className={styles.error}>{error}</p>}
          {candidates.slice(candidatePage * 3, candidatePage * 3 + 3).map((candidate, offset) => <article id={`mentor-candidate-${candidate.id}`} key={candidate.id} className={styles.proposal} data-focused={focusedCandidate === candidate.id}>
            <span className={styles.eyebrow}>IDEA {candidatePage * 3 + offset + 1} · <span>{candidate.versionId ? "SAVED IDEA" : "UNSAVED"}</span></span><h3>{candidate.fields.title || "Untitled direction"}</h3>
            <dl>{([ ["audience", "For"], ["problem", "Problem"], ["workflow", "Approach"], ["constraints", "Constraints"] ] as const).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{candidate.fields[key] || "Not yet discussed"}</dd></div>)}</dl>
            <details><summary>Review / edit full idea</summary>{FIELDS.map(({name,label}) => <label key={name}>{label}<textarea disabled={busy || !!candidate.versionId} value={candidate.fields[name] ?? ""} onChange={(event) => { const value = event.target.value; const saveKey = crypto.randomUUID(); setCandidates((old) => old.map((item) => item.id === candidate.id ? { ...item, saveKey, fields: { ...item.fields, [name]: value || null } } : item)); }} /></label>)}</details>
            {!candidate.versionId && <button type="button" disabled={busy} onClick={() => void save(candidate)}>Proceed with this idea</button>}
            <button type="button" disabled={!activeAudio || voiceState === "Connecting"} onClick={() => live.current?.send(`Let's discuss this candidate, including its risks and alternatives: ${JSON.stringify(candidate.fields)}`)}>Discuss this idea</button>
          </article>)}
          {candidates.length > 3 && <div className={styles.next}><button disabled={candidatePage === 0} onClick={() => setCandidatePage((page) => page - 1)}>Previous ideas</button><span>{candidatePage + 1} / {Math.ceil(candidates.length / 3)}</span><button disabled={(candidatePage + 1) * 3 >= candidates.length} onClick={() => setCandidatePage((page) => page + 1)}>Next ideas</button></div>}
        </section>, ideasMount)}
        {busy && <p role="status">Thinking through your idea…</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {(messages.length >= 2 || saved) && <div className={styles.next}><button type="button" onClick={() => navigate("explore")}>Explore the map</button>{saved && <button type="button" onClick={() => navigate("idea")}>See evidence</button>}<button type="button" onClick={openTeam}>Add a teammate</button></div>}
      </div>
      <button type="button" className={styles.typeToggle} aria-expanded={typing} onClick={() => setTyping(!typing)}>{typing ? "Hide typing" : "Prefer to type?"}</button>
      {typing && <form className={styles.compose} onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <textarea ref={textarea} aria-label="Message Uncharted" placeholder="What are you thinking about?" maxLength={8000} rows={2} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send message">↑</button>
      </form>}
      <div className={styles.status} role="status">{voiceState}{activeAudio && <button type="button" onClick={() => live.current?.end()}>End conversation</button>}</div>
    </section>, notesMount)}
    {voiceNotice && <div className={styles.voiceNotice} role="status"><span>{voiceNotice}</span><button type="button" aria-label="Dismiss voice notice" onClick={() => setVoiceNotice("")}>×</button></div>}
    <div className={styles.dock}>
      <button className={styles.utility} type="button" aria-expanded={open} onClick={() => { if (open) close(); else { location.hash = "talk"; setOpen(true); } }}>Type / transcript</button>
      <button ref={launcher} className={styles.bubble} data-state={voiceState.toLowerCase()} type="button" disabled={!voiceReady} aria-label={voiceState === "Connecting" ? "Connecting live conversation" : activeAudio ? voiceState === "Muted" ? "Unmute conversation" : "Mute conversation" : "Start live voice conversation"} aria-describedby="voice-caption" onClick={() => { if (voiceState === "Connecting") return; if (activeAudio) live.current?.toggleMute(); else { close(); startVoice.current?.(); } }}>
        <span className={styles.wave} aria-hidden="true"><i /><i /><i /><i /></span>
      </button>
      {activeAudio ? <button className={styles.utility} type="button" onClick={() => live.current?.end()}>End conversation</button> : <button className={styles.utility} type="button" onClick={() => navigate("idea")}>Ideas{candidates.length ? ` · ${candidates.length}` : ""}</button>}
    </div>
    <span id="voice-caption" className={styles.caption} role="status">{activeAudio ? `${voiceState}${voiceState === "Connecting" ? "…" : voiceState === "Muted" ? " · Tap to unmute" : " · Tap to mute"}` : voiceReady ? "Tap to talk · Uses microphone · ElevenLabs" : "Preparing voice…"}</span>
  </div>;
}
