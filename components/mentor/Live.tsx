"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useEffect, useRef, useState } from "react";
import { initWorkspace } from "@/components/workspace/api";
import { getState } from "@/lib/store";
import type { Fields } from "@/components/idea/fields";
import { readFields, request, toolIdentity } from "./protocol";

export type LiveControls = { send: (text: string) => void; end: () => void };
type Props = {
  onMessage: (role: "user" | "mentor", text: string) => void;
  onProposal: (fields: Fields) => void;
  onEvidence: (projects: { projectId: string; title: string; url: string; excerpt: string }[]) => void;
  onState: (state: string) => void;
  onControls: (controls: LiveControls | null) => void;
};

export default function Live(props: Props) { return <ConversationProvider><Session {...props} /></ConversationProvider>; }

function Session(props: Props) {
  const callbacks = useRef(props);
  callbacks.current = props;
  const [notice, setNotice] = useState("");
  const [starting, setStarting] = useState(false);
  const session = useRef<string | null>(null);
  const epoch = useRef(0);
  const turn = useRef(0);
  const requests = useRef(new Set<AbortController>());
  const conversation = useConversation();
  const endRef = useRef(conversation.endSession);
  endRef.current = conversation.endSession;

  function release() {
    epoch.current++;
    for (const controller of requests.current) controller.abort();
    requests.current.clear();
    const id = session.current;
    session.current = null;
    if (id) void fetch(`/api/mentor/session/${encodeURIComponent(id)}`, { method: "DELETE", keepalive: true }).catch(() => undefined);
    endRef.current();
    callbacks.current.onControls(null);
  }
  function end() { release(); setStarting(false); callbacks.current.onState("Ended"); }
  useEffect(() => () => { release(); }, []);

  async function start() {
    if (starting || session.current) return;
    const generation = ++epoch.current;
    callbacks.current.onControls({ send: () => undefined, end });
    setStarting(true); setNotice(""); callbacks.current.onState("Connecting");
    try {
      const workspace = await initWorkspace();
      if (!workspace.ok) throw new Error("Your workspace could not start. Please retry.");
      // Explicit click only. A denied microphone must not spend a provider session reservation.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      if (generation !== epoch.current) return;
      const result = await request("/api/mentor/session", {});
      if (generation !== epoch.current) {
        if (result?.sessionId) void fetch(`/api/mentor/session/${encodeURIComponent(result.sessionId)}`, { method: "DELETE" });
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
        conversationToken: result.conversationToken, connectionType: "webrtc",
        clientTools: {
          get_context: (args) => tool("get_context", args),
          find_projects: (args) => tool("find_projects", args),
          propose_idea: (args) => tool("propose_idea", args),
        },
        onConnect: () => {
          if (!active()) return endRef.current();
          setStarting(false); callbacks.current.onState("Listening");
          conversation.sendContextualUpdate(`Selected saved version: ${getState().activeIdeaVersionId ?? "none"}. Ask one useful question at a time. Avoid automatic praise; examine motivations, failure modes and missing evidence. Never save without an explicit app confirmation.`);
          callbacks.current.onControls({ send: (text) => conversation.sendUserMessage(text), end });
        },
        onMessage: (message) => {
          if (!active()) return;
          if (message.source === "user") turn.current++;
          callbacks.current.onMessage(message.source === "user" ? "user" : "mentor", message.message);
        },
        onModeChange: ({ mode }) => active() && callbacks.current.onState(mode === "speaking" ? "Speaking" : "Listening"),
        onDisconnect: () => { if (active()) { release(); setStarting(false); callbacks.current.onState("Disconnected"); } },
        onError: () => { if (active()) { release(); setStarting(false); setNotice("Live connection failed. Your text conversation is still available."); callbacks.current.onState("Unavailable"); } },
      });
    } catch (error) {
      if (generation !== epoch.current) return;
      release(); setStarting(false); callbacks.current.onState("Unavailable");
      setNotice(error instanceof DOMException && error.name === "NotAllowedError" ? "Microphone blocked. Continue the conversation by typing below." : error instanceof Error ? error.message : "Live conversation is unavailable. You can still type below.");
    }
  }

  return <div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {!session.current && !starting && <button type="button" onClick={start}>Start live conversation</button>}
      {(starting || conversation.status === "connected") && <button type="button" onClick={end}>Stop and end</button>}
      {conversation.status === "connected" && <button type="button" aria-pressed={conversation.isMuted} onClick={() => conversation.setMuted(!conversation.isMuted)}>{conversation.isMuted ? "Unmute" : "Mute"}</button>}
    </div>
    <p style={{ fontSize: 12, color: "#b9c3d4", marginTop: 8 }}>Live audio uses ElevenLabs. Your microphone starts only when you choose it.</p>
    {notice && <p role="status">{notice}</p>}
  </div>;
}
