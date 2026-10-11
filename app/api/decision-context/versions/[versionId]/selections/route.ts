import { selectSchema } from "@/lib/decision-context/contract";
import { route } from "@/lib/decision-context/http";
import { select } from "@/lib/decision-context/service";
export const runtime = "nodejs";
export const POST = route(true, selectSchema, "Send recommendationId, expectedSelectionRevision and a scope (core, optional or later) for each feature.",
  async (workspaceId, versionId, b) => ({ data: await select(workspaceId, versionId!, b), status: 201 }));
