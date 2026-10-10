import type { NextRequest } from "next/server";
import { boundary, respond, sameOrigin } from "@/lib/workspace/http";
import { requireWorkspace, session } from "@/lib/workspace/require";
import { createWorkspace } from "@/lib/workspace/service";
export const runtime = "nodejs";
export function GET(request: NextRequest) {
  return boundary(async () => respond(await requireWorkspace(request)));
}
export function POST(request: NextRequest) {
  return boundary(async () => {
    sameOrigin(request);
    const existing = await session(request);
    if (existing) return respond(existing);
    const created = await createWorkspace();
    return respond(created.identity, 201, created.token);
  });
}
