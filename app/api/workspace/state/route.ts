import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { boundary, respond } from "@/lib/workspace/http";
import { workspaceState } from "@/lib/workspace/state";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return boundary(async () => {
    const identity = await requireWorkspace(request);
    return respond(await workspaceState(identity.workspaceId));
  });
}
