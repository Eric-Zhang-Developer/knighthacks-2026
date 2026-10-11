import { recommendSchema } from "@/lib/decision-context/contract";
import { route } from "@/lib/decision-context/http";
import { recommend } from "@/lib/decision-context/service";
export const runtime = "nodejs";
export const POST = route(true, recommendSchema, "Send the profileRevision to recommend against (0 for no profile).",
  async (workspaceId, versionId, b) => ({ data: await recommend(workspaceId, versionId!, b.profileRevision), status: 201 }));
