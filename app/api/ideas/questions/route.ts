import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { IdeaError } from "@/lib/ideas/contract";
import { readBody } from "@/lib/ideas/http";
import { InterviewError, requestSchema } from "@/lib/interview/contract";
import { nextQuestions } from "@/lib/interview/service";
export const runtime = "nodejs";
// POST /api/ideas/questions {fields, answers} -> {questions, done}. No database writes; text and voice both call it.
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    await requireWorkspace(request);
    const parsed = requestSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new InterviewError(400, "Send `fields` (the interpreted idea) and up to 9 `answers`.");
    return respond(await nextQuestions(parsed.data));
  } catch (error) {
    if (error instanceof InterviewError || error instanceof IdeaError || error instanceof WorkspaceError) return respond({ error: error.message }, error.status);
    return respond({ error: "Follow-up questions are temporarily unavailable. Please try again." }, 503);
  }
}
