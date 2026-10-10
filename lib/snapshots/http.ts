import { z } from "zod";
import type { NextRequest } from "next/server";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { requireWorkspace } from "@/lib/workspace/require";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { readBody } from "@/lib/ideas/http";
import { IdeaError } from "@/lib/ideas/contract";
import { EvidenceError } from "@/lib/evidence/contract";
import { createSchema, SnapshotError } from "./contract";
import { createSnapshot, getSnapshot } from "./service";
async function boundary(action: () => Promise<ReturnType<typeof respond>>) {
  try { return await action(); }
  catch (error) {
    if (error instanceof SnapshotError || error instanceof WorkspaceError || error instanceof IdeaError || error instanceof EvidenceError) return respond({ error: error.message }, error.status);
    return respond({ error: "Snapshots are temporarily unavailable. Please retry." }, 503);
  }
}
export async function createRoute(request: NextRequest) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request);
    const body = createSchema.safeParse(await readBody(request));
    if (!body.success) throw new SnapshotError(400, "Provide only a valid versionId");
    return respond(await createSnapshot(identity.workspaceId, body.data.versionId), 201);
  });
}
export async function getRoute(request: NextRequest, id: Promise<string>) {
  return boundary(async () => {
    const identity = await requireWorkspace(request), snapshotId = await id;
    if (!z.uuid().safeParse(snapshotId).success) throw new SnapshotError(400, "Invalid snapshot ID");
    return respond(await getSnapshot(identity.workspaceId, snapshotId));
  });
}
