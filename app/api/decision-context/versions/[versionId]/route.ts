import { route } from "@/lib/decision-context/http";
import { getContext } from "@/lib/decision-context/service";
export const runtime = "nodejs";
export const GET = route(false, null, "", async (workspaceId, versionId) => ({ data: await getContext(workspaceId, versionId!) }));
