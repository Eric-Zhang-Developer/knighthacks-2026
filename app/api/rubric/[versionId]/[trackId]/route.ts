import type { NextRequest } from "next/server";
import { proofRoute } from "@/lib/rubric/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const PATCH = (request: NextRequest, context: { params: Promise<{ versionId: string; trackId: string }> }) => proofRoute(request, context.params);
