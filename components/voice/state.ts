export type LiveTalkState = "idle" | "listening" | "thinking" | "speaking" | "error";

type ScribeStatus = "disconnected" | "connecting" | "connected" | "transcribing" | "error";

export function liveTalkState(input: {
  notice: string | null;
  holding: boolean;
  status: ScribeStatus;
  partialTranscript: string;
}): LiveTalkState {
  if (input.notice || input.status === "error") return "error";
  if (input.holding && input.partialTranscript.trim()) return "speaking";
  if (input.holding && input.status === "connected") return "listening";
  if (input.holding || input.status === "connecting" || input.status === "transcribing") return "thinking";
  return "idle";
}

export const LIVE_TALK_COPY: Record<LiveTalkState, { label: string; detail: string; glyph: string }> = {
  idle: { label: "Idle", detail: "Hold to add speech to your idea", glyph: "○" },
  listening: { label: "Listening", detail: "Start speaking; release to add", glyph: "◌" },
  thinking: { label: "Thinking", detail: "Preparing or transcribing", glyph: "…" },
  speaking: { label: "Speaking", detail: "Speech detected; release to add", glyph: "■" },
  error: { label: "Error", detail: "Voice stopped; text still works", glyph: "!" },
};
