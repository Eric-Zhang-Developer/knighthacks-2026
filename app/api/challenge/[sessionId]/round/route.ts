import type { NextRequest } from "next/server";
import { sessionRoute } from "@/lib/challenge/http";
export const runtime = "nodejs";
export async function POST(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  return sessionRoute(request, context.params.then((p) => p.sessionId), "round");
}
