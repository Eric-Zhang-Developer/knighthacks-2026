import type { NextRequest } from "next/server";
import { z } from "zod";
import { sameOrigin, respond } from "@/lib/workspace/http";
import { requireWorkspace } from "@/lib/workspace/require";
import { boundary } from "@/lib/mentor/http";
import { MentorError } from "@/lib/mentor/contract";
import { endSession } from "@/lib/mentor/store";

export const runtime = "nodejs";
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request);
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) throw new MentorError(404, "Mentor session not found");
    await endSession(identity, id);
    return respond({ sessionId: id, status: "ended" });
  });
}
