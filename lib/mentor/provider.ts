import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { MentorError } from "./contract";

const UNAVAILABLE = "The spoken mentor is unavailable. You can keep working with text.";

// Server-only capability issuer. Never return provider diagnostics or credentials in errors.
export function configuredAgent(): { apiKey: string; agentId: string } {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const agentId = process.env.ELEVENLABS_MENTOR_AGENT_ID?.trim();
  if (!apiKey || !agentId || !/^agent_[a-zA-Z0-9_-]+$/.test(agentId)) throw new MentorError(503, UNAVAILABLE);
  return { apiKey, agentId };
}

export async function mintConversationToken(): Promise<string> {
  const { apiKey, agentId } = configuredAgent();
  try {
    const { token } = await new ElevenLabsClient({ apiKey }).conversationalAi.conversations.getWebrtcToken(
      { agentId }, { timeoutInSeconds: 15, maxRetries: 0 },
    );
    if (typeof token !== "string" || !token.trim()) throw new Error("Missing capability");
    return token;
  } catch {
    throw new MentorError(503, UNAVAILABLE);
  }
}
