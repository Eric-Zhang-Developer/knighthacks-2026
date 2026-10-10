import type { NextRequest } from "next/server";
import { listRoute, startRoute } from "@/lib/experiments/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (request: NextRequest) => listRoute(request);
export const POST = (request: NextRequest) => startRoute(request);
