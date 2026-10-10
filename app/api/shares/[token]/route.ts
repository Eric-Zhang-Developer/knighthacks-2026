import type { NextRequest } from "next/server";
import { readRoute, revokeRoute } from "@/lib/shares/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ token: string }> };
export async function GET(request: NextRequest, context: Context) {
  return readRoute(request, context.params.then((p) => p.token));
}
export async function DELETE(request: NextRequest, context: Context) {
  return revokeRoute(request, context.params.then((p) => p.token));
}
