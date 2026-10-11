import type { NextRequest } from "next/server";
import { confirmRoute } from "@/lib/sponsor-challenges/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<Record<string, string>> };
export const POST = (request: NextRequest, context: Context) => confirmRoute(request, context.params);
