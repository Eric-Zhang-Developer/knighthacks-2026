import { mintScribeToken } from "@/lib/voice/token";

export const dynamic = "force-dynamic";

// POST /api/voice/token -> { token } for one realtime speech-to-text session, or 503 when voice is unavailable.
export async function POST() {
  const token = await mintScribeToken();
  if (!token) return Response.json({ error: "voice unavailable" }, { status: 503 });
  return Response.json({ token }, { headers: { "Cache-Control": "no-store" } });
}
