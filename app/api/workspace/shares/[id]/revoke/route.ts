import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { boundary, respond, sameOrigin } from "@/lib/workspace/http";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { revokeListedShare } from "@/lib/workspace/state";
export const runtime = "nodejs";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request);
    const { id } = await context.params;
    if (!/^[0-9a-f]{16}$/.test(id)) throw new WorkspaceError(404, "Share not found");
    const reader = request.body?.getReader();
    if (reader) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value.byteLength) { await reader.cancel(); throw new WorkspaceError(400, "Share revocation accepts no body"); }
        }
      } finally { reader.releaseLock(); }
    }
    return respond(await revokeListedShare(identity.workspaceId, id));
  });
}
