import { neon } from "@neondatabase/serverless";
import { missingTables, tableNames } from "./tables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Every db/schema/ file, collected at build time, so a new schema file needs no edit here.
type Context = { keys(): string[]; (key: string): Record<string, unknown> };
const schema = (require as unknown as { context(dir: string, deep: boolean, re: RegExp): Context }).context("../../../../db/schema", false, /\.ts$/);
const expected = tableNames(schema.keys().map((k) => schema(k)));

let cache: { at: number; missing: string[] } | undefined;

// 503 names the tables db/schema/ defines and DATABASE_URL lacks, so verify_release.py's smoke check fails on them.
export async function GET() {
  if (!cache || Date.now() - cache.at > 60_000) {
    try {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error("DATABASE_URL is not set");
      const rows = await neon(url)`select table_name from information_schema.tables where table_schema = 'public'`;
      cache = { at: Date.now(), missing: missingTables(expected, rows.map((r) => String(r.table_name))) };
    } catch {
      return Response.json({ schema: "unknown" }, { status: 503 });
    }
  }
  return cache.missing.length
    ? Response.json({ schema: { missing: cache.missing } }, { status: 503 })
    : Response.json({ schema: "ok" });
}
