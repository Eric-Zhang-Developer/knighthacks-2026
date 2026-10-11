import type { NextRequest } from "next/server";
import { deleteRoute, readRoute } from "@/lib/sponsor-challenges/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<Record<string, string>> };
export const GET = (request: NextRequest, context: Context) => readRoute(request, context.params);
export const DELETE = (request: NextRequest, context: Context) => deleteRoute(request, context.params);
