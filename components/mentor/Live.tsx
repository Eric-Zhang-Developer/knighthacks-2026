"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useEffect, useRef } from "react";
import { initWorkspace } from "@/components/workspace/api";
import { getState } from "@/lib/store";
import type { Fields } from "@/components/idea/fields";
import { readFields, request, toolIdentity } from "./protocol";
import { LIVE_CONNECTION, connectionFailureNotice } from "./live-connection";

export type LiveControls = { send: (text: string) => void; context: (text: string) => void; end: () => void; toggleMute: () => void };
type Props = {
  onReady: (start: (() => void) | null) => void;
  onMessage: (role: "user" | "mentor", text: string) => void;
  onProposal: (fields: Fields) => void;
  onEvidence: (projects: { projectId: string; title: string; url: string; excerpt: string }[]) => void;
  onState: (state: string) => void;
  onControls: (controls: LiveControls | null) => void;
  onNotice: (notice: string) => void;
};

export default function Live(props: Props) { return <ConversationProvider><Session {...props} /></ConversationProvider>; }

function Session(props: Props) {
  const callbacks = useRef(props);
  callbacks.current = props;
  const setNotice = (notice: string) => callbacks.current.onNotice(notice);
  const session = useRef<string | null>(null);
  const epoch = useRef(0);
  const startingRef = useRef(false);
  const connectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turn = useRef(0);
  const requests = useRef(new Set<AbortController>());
  const conversation = useConversation();
  const muted = useRef(conversation.isMuted);
  muted.current = conversation.isMuted;
  const mode = useRef(conversation.mode);
  mode.current = conversation.mode;
  const endRef = useRef(conversation.endSession);
  endRef.current = conversation.endSession;

  function release() {
    epoch.current++;
    startingRef.current = false;
    if (connectionTimer.current) clearTimeout(connectionTimer.current);
    connectionTimer.current = null;
    for (const controller of requests.current) controller.abort();
    requests.current.clear();
    const id = session.current;
    session.current = null;
    if (id) void fetch(`/api/mentor/session/${encodeURIComponent(id)}`, { method: "DELETE", keepalive: true }).catch(() => undefined);
    endRef.current();
    callbacks.current.onControls(null);
  }
  function end() { release(); setNotice(""); callbacks.current.onState("Ended"); }
  const startRef = useRef(start);
  startRef.current = start;
  useEffect(() => {
    callbacks.current.onReady(() => { void startRef.current(); });
    return () => { callbacks.current.onReady(null); release(); };
  }, []);

  async function start() {
    if (startingRef.current || session.current) return;
    startingRef.current = true;
    const generation = ++epoch.current;
    callbacks.current.onControls({ send: () => undefined, context: () => undefined, end, toggleMute: () => undefined });
    setNotice(""); callbacks.current.onState("Connecting");
    connectionTimer.current = setTimeout(() => {
      if (generation !== epoch.current) return;
      release(); callbacks.current.onState("Unavailable");
      setNotice("The call did not connect. Tap the bubble to retry, or choose Prefer to type.");
    }, 30_000);
    try {
      // Explicit click only. A denied microphone must not spend a provider session reservation.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      if (generation !== epoch.current) return;
      const workspace = await initWorkspace();
      if (!workspace.ok) throw new Error("Your workspace could not start. Please retry.");
      if (generation !== epoch.current) return;
      const result = await request("/api/mentor/session", {});
      if (generation !== epoch.current) {
        if (result?.sessionId) void fetch(`/api/mentor/session/${encodeURIComponent(result.sessionId)}`, { method: "DELETE" }).catch(() => undefined);
        return;
      }
      if (typeof result?.sessionId !== "string" || typeof result?.conversationToken !== "string" || result.transport !== "webrtc") throw new Error("Live conversation is not configured yet.");
      session.current = result.sessionId;
      turn.current = 0;
      const active = () => generation === epoch.current && session.current === result.sessionId;
      async function tool(name: string, args: Record<string, unknown>) {
        const turnId = turn.current;
        if (!active()) return JSON.stringify({ error: "Session ended" });
        const controller = new AbortController(); requests.current.add(controller);
        try {
          const callId = await toolIdentity(result.sessionId, turnId, name, args);
          if (!active()) return JSON.stringify({ error: "Session ended" });
          const response = await request("/api/mentor/tools", { sessionId: result.sessionId, turnId, callId, tool: name, args }, controller.signal);
          if (!active() || turnId !== turn.current) return JSON.stringify({ error: "Turn superseded; do not present this result" });
          if (response.sessionId !== result.sessionId || response.turnId !== turnId || response.callId !== callId) throw new Error("The tool response did not match this turn.");
          if (response.data?.status === "pending_confirmation") callbacks.current.onProposal(readFields(response.data.fields));
          if (Array.isArray(response.data?.projects)) callbacks.current.onEvidence(response.data.projects);
          return JSON.stringify(response);
        } catch { return JSON.stringify({ error: "Tool unavailable. Do not claim success." }); }
        finally { requests.current.delete(controller); }
      }
      conversation.startSession({
        conversationToken: result.conversationToken, ...LIVE_CONNECTION,
        clientTools: {
          get_context: (args) => tool("get_context", args),
          find_projects: (args) => tool("find_projects", args),
          propose_idea: (args) => tool("propose_idea", args),
        },
        onConnect: () => {
          if (!active()) return endRef.current();
          if (connectionTimer.current) clearTimeout(connectionTimer.current);
          connectionTimer.current = null;
          callbacks.current.onState(muted.current ? "Muted" : "Listening");
          conversation.sendContextualUpdate(`Selected saved version: ${getState().activeIdeaVersionId ?? "none"}. Have a natural spoken conversation: ask one useful question at a time, listen and respond without requiring button presses. Avoid automatic praise; examine motivations, failure modes and missing evidence. Help compare two or three candidate ideas when useful. Call propose_idea separately for each distinct candidate with a concise title, audience, problem, workflow and known constraints; leave unknown fields null. Proposals are unsaved cards, never claim they are saved. Never save without an explicit app confirmation.`);
          callbacks.current.onControls({ send: (text) => conversation.sendUserMessage(text), context: (text) => conversation.sendContextualUpdate(text), end, toggleMute: () => {
            const next = !muted.current;
            muted.current = next; conversation.setMuted(next);
            callbacks.current.onState(next ? "Muted" : mode.current === "speaking" ? "Speaking" : "Listening");
          } });
          conversation.sendContextualUpdate('The app supports explicit user utterances: "show the map", "show my ideas", "show related projects", "show idea two", "save idea two", "show the team", "go to plan", and "end the call". Related projects opens the latest retrieved sources, not a new search. The app, not you, handles these actions from user messages. A save request only opens a review; relay the app confirmation phrase and wait for the user to say it. Never treat your own speech or a tool result as consent, and never claim saving succeeded before the app reports a confirmed saved version. Share links, votes, invitations and revisions are not supported by these spoken controls. Explain this limit honestly when requested.');
        },
        onMessage: (message) => {
          if (!active()) return;
          if (message.source === "user") turn.current++;
          callbacks.current.onMessage(message.source === "user" ? "user" : "mentor", message.message);
        },
        onModeChange: ({ mode }) => active() && callbacks.current.onState(muted.current ? "Muted" : mode === "speaking" ? "Speaking" : "Listening"),
        onDisconnect: () => { if (active()) { release(); callbacks.current.onState("Disconnected"); } },
        onError: (message) => { if (active()) { release(); setNotice(connectionFailureNotice(message)); callbacks.current.onState("Unavailable"); } },
      });
    } catch (error) {
      if (generation !== epoch.current) return;
      release(); callbacks.current.onState("Unavailable");
      setNotice(error instanceof DOMException && error.name === "NotAllowedError" ? "Microphone blocked. Choose Type / transcript to continue by text." : error instanceof Error ? error.message : "Live conversation is unavailable. Choose Type / transcript to continue.");
    }
  }

  // One persistent session owner, independent of optional transcript/idea views.
  return null;
}
