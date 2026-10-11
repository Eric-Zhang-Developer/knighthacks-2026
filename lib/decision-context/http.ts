import type { NextRequest } from "next/server";
import { z } from "zod";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { requireWorkspace } from "@/lib/workspace/require";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { DecisionError } from "./contract";

type Params = { params: Promise<{ versionId?: string }> };
// Auth first, then the version id, then the body; every failure is a safe message with its status.
export function route<T>(write: boolean, schema: z.ZodType<T> | null, hint: string,
  action: (workspaceId: string, versionId: string | null, body: T) => Promise<{ data: unknown; status?: number }>) {
  return async (request: NextRequest, context: Params) => {
    try {
      if (write) sameOrigin(request);
      const { workspaceId } = await requireWorkspace(request);
      const { versionId = null } = (await context?.params) ?? {};
      if (versionId !== null && !z.uuid().safeParse(versionId).success) throw new DecisionError(404, "Idea version not found");
      let body = undefined as T;
      if (schema) {
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) throw new DecisionError(400, hint);
        body = parsed.data;
      }
      const { data, status } = await action(workspaceId, versionId, body);
      return respond(data, status ?? 200);
    } catch (error) {
      if (error instanceof DecisionError || error instanceof WorkspaceError) return respond({ error: error.message }, error.status);
      return respond({ error: "Team fit and scope are temporarily unavailable. Please try again." }, 503);
    }
  };
}
