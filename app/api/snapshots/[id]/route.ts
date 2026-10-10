import type { NextRequest } from "next/server";
import { getRoute } from "@/lib/snapshots/http";
export const runtime = "nodejs";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getRoute(request, context.params.then((p) => p.id));
}
