import type { NextRequest } from "next/server";
import { createRoute, readRoute } from "@/lib/rubric/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ versionId: string }> };
export const POST = (request: NextRequest, context: Context) => createRoute(request, context.params.then((value) => value.versionId));
export const GET = (request: NextRequest, context: Context) => readRoute(request, context.params.then((value) => value.versionId));
