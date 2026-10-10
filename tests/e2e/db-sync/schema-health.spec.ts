import { readdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";

// The expected answer is computed from the same database the server reads, so this holds on a synced or a lagging
// branch: the route must name exactly the db/schema tables that database lacks.
test("schema health names exactly the missing db/schema tables; /api/health stays the liveness check", async ({ request }, info) => {
  const expected = [...new Set(readdirSync("db/schema").filter((f) => f.endsWith(".ts"))
    .flatMap((f) => [...readFileSync(join("db/schema", f), "utf8").matchAll(/pgTable\(\s*"([^"]+)"/g)].map((m) => m[1])))].sort();
  const rows = await neon(process.env.DATABASE_URL!)`select table_name from information_schema.tables where table_schema = 'public'`;
  const present = new Set(rows.map((r) => String(r.table_name)));
  const missing = expected.filter((t) => !present.has(t));

  const res = await request.get("/api/health/schema");
  const body = await res.json();
  if (missing.length) {
    expect(res.status()).toBe(503);
    expect(body).toEqual({ schema: { missing } });
  } else {
    expect(res.status()).toBe(200);
    expect(body).toEqual({ schema: "ok" });
  }

  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(Object.keys(await health.json())).toEqual(["commit"]);
  await writeFile(info.outputPath("schema-health.json"), JSON.stringify({ expected, missing, status: res.status(), body }, null, 2));
});
