import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { boundary, readBody } from "@/lib/ideas/http";
import { IdeaError, interpretSchema } from "@/lib/ideas/contract";
import { interpret } from "@/lib/ideas/interpret";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return boundary(async () => {
    sameOrigin(request);
    await requireWorkspace(request);
    const parsed = interpretSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new IdeaError(400, "Provide nonblank idea text up to 8000 characters");
    return respond(await interpret(parsed.data.text));
  });
}
