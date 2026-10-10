import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

// Server only: the API key never leaves this module, and the browser only ever sees a single-use token.
export async function mintScribeToken(apiKey = process.env.ELEVENLABS_API_KEY): Promise<string | null> {
  if (!apiKey) return null;
  try {
    const { token } = await new ElevenLabsClient({ apiKey }).tokens.singleUse.create("realtime_scribe");
    return token;
  } catch {
    return null;
  }
}
