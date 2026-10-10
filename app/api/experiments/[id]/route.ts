import type { NextRequest } from "next/server";
import { patchRoute } from "@/lib/experiments/http";
export const runtime = "nodejs";
export const PATCH = (request: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  patchRoute(request, params.then((p) => p.id));
