import type { NextRequest } from "next/server";
import { assessmentRoute } from "@/lib/sponsor-challenges/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<Record<string, string>> };
export const GET = (request: NextRequest, context: Context) => assessmentRoute(request, context.params);
