import { mintScribeToken } from "@/lib/voice/token";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { sameOrigin } from "@/lib/workspace/http";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { reserveVoiceToken, TOKEN_LIMIT, TOKEN_WINDOW_SECONDS } from "@/lib/voice/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const identity = await requireWorkspace(request);
    sameOrigin(request);
    if (!process.env.ELEVENLABS_API_KEY) return Response.json({ error: "voice unavailable" }, { status: 503, headers });
    if (!await reserveVoiceToken(identity.memberId)) {
      return Response.json({ error: "Voice token limit reached. Try again shortly." }, {
        status: 429, headers: { ...headers, "Retry-After": String(TOKEN_WINDOW_SECONDS), "X-RateLimit-Limit": String(TOKEN_LIMIT) },
      });
    }
    const token = await mintScribeToken();
    if (!token) return Response.json({ error: "voice unavailable" }, { status: 503, headers });
    return Response.json({ token }, { headers });
  } catch (error) {
    if (error instanceof WorkspaceError) return Response.json({ error: error.message }, { status: error.status, headers });
    return Response.json({ error: "voice unavailable" }, { status: 503, headers });
  }
}
