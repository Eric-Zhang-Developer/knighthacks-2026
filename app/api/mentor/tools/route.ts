import type { NextRequest } from "next/server";
import { sameOrigin, respond } from "@/lib/workspace/http";
import { requireWorkspace } from "@/lib/workspace/require";
import { boundary, readJson } from "@/lib/mentor/http";
import { toolSchema, callIdFor, MentorError } from "@/lib/mentor/contract";
import { reserveTool, completeTool, failTool } from "@/lib/mentor/store";
import { executeTool } from "@/lib/mentor/tools";

export const runtime = "nodejs";
export const maxDuration = 90;
export async function POST(request: NextRequest) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request);
    const parsed = toolSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new MentorError(400, "Invalid mentor tool request");
    const call = parsed.data;
    if (callIdFor(call) !== call.callId) throw new MentorError(409, "Tool call identity does not match its body");
    const envelope = { sessionId: call.sessionId, turnId: call.turnId, callId: call.callId, tool: call.tool };
    const reserved = await reserveTool(identity, call);
    if (reserved.status === "pending") {
      const response = respond({ ...envelope, status: "pending" }, 202);
      response.headers.set("Retry-After", "1");
      return response;
    }
    if (reserved.status === "replay") return respond({ ...envelope, data: reserved.data });
    try {
      const data = await executeTool(identity, call, reserved.sourceIds);
      await completeTool(identity, call, data);
      return respond({ ...envelope, data });
    } catch (error) {
      await failTool(identity, call).catch(() => undefined);
      throw error;
    }
  });
}
