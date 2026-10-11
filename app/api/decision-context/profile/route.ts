import { putSchema } from "@/lib/decision-context/contract";
import { route } from "@/lib/decision-context/http";
import { getProfile, putProfile } from "@/lib/decision-context/service";
export const runtime = "nodejs";
export const GET = route(false, null, "", async (workspaceId) => ({ data: await getProfile(workspaceId) }));
export const PUT = route(true, putSchema,
  "Send expectedRevision and a profile: interests, skills and hardware (up to 12 entries of 80 characters), hoursLeft (0.25–72 or null), teamSize (1–20 or null) and enthusiasm (1–5 or null).",
  async (workspaceId, _, b) => ({ data: await putProfile(workspaceId, b.expectedRevision, b.profile) }));
