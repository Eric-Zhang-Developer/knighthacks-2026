import type { NextRequest } from "next/server";
import { importRoute, listRoute } from "@/lib/sponsor-challenges/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = (request: NextRequest) => importRoute(request);
export const GET = (request: NextRequest) => listRoute(request);
