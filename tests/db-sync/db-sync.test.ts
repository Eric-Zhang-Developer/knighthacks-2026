import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { missingTables, tableNames } from "@/app/api/health/schema/tables";
import { classify, fkKey, plan, statements } from "@/scripts/db-sync.mjs";

const EXPORT = `CREATE TABLE "ideas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	CONSTRAINT "ideas_workspace_idempotency" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "moments" (
	"version_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
DROP TABLE "evidence_cards" CASCADE;
ALTER TABLE "ideas" ALTER COLUMN "id" SET DATA TYPE text;
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "moments" ADD CONSTRAINT "moments_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "ideas_latest" ON "ideas" USING btree ("workspace_id");`;

const parsed = statements(EXPORT).map(classify);
const live = (columns: Record<string, string[]>, indexes: string[] = [], foreignKeys: string[] = []) => ({
  columns: new Map(Object.entries(columns).map(([t, c]) => [t, new Set(c)])),
  indexes: new Set(indexes),
  foreignKeys: new Set(foreignKeys),
});

test("a DROP, an ALTER COLUMN or an extension never reaches the plan", () => {
  const { apply } = plan(parsed, live({}));
  expect(apply.map((s: { sql: string }) => s.sql).join("\n")).not.toMatch(/DROP|ALTER COLUMN|EXTENSION/);
  expect(parsed.filter((s: { kind: string }) => s.kind === "other")).toHaveLength(3);
});

test("an empty database gets tables, then foreign keys, then indexes", () => {
  const { apply, drift } = plan(parsed, live({}));
  expect(apply.map((s: { kind: string; name: string }) => `${s.kind}:${s.name}`)).toEqual([
    "table:ideas", "table:moments", "fk:moments_version_id_fk", "index:ideas_latest",
  ]);
  expect(drift).toEqual([]);
});

test("only what is missing is planned; existing objects are never touched", () => {
  const { apply } = plan(parsed, live({ ideas: ["id", "workspace_id"] }, ["ideas_latest"]));
  expect(apply.map((s: { name: string }) => s.name)).toEqual(["moments", "moments_version_id_fk"]);
  const synced = plan(parsed, live({ ideas: ["id", "workspace_id"], moments: ["version_id", "data"] }, ["ideas_latest"], [fkKey("moments", ["version_id"], "ideas")]));
  expect(synced.apply).toEqual([]);
});

test("a foreign key under another name (Postgres's default _fkey) counts as present", () => {
  const fk = parsed.find((s: { kind: string }) => s.kind === "fk");
  expect(fk.key).toBe("moments(version_id)->ideas");
  const { apply } = plan(parsed, live({ ideas: ["id", "workspace_id"], moments: ["version_id", "data"] }, ["ideas_latest"], ["moments(version_id)->ideas"]));
  expect(apply).toEqual([]);
});

test("a table lacking a schema column is drift, by column name; constraint lines aren't columns", () => {
  const { drift } = plan(parsed, live({ ideas: ["id"], moments: ["version_id", "data", "extra"] }));
  expect(drift).toEqual(["ideas.workspace_id"]);
});

test("the real export parses into one table per db/schema table and nothing unrecognized", async () => {
  const root = process.cwd();
  const modules = await Promise.all(
    readdirSync(join(root, "db/schema")).filter((f) => f.endsWith(".ts")).map((f) => import(join(root, "db/schema", f))),
  );
  const names = tableNames(modules);
  expect(names).toContain("moments");
  const sql = execFileSync(process.execPath, [join(root, "node_modules/drizzle-kit/bin.cjs"), "export", "--sql"], { cwd: root, encoding: "utf8" });
  const real = statements(sql).map(classify);
  expect(real.filter((s: { kind: string }) => s.kind === "other")).toEqual([]);
  expect(real.filter((s: { kind: string }) => s.kind === "table").map((s: { name: string }) => s.name).sort()).toEqual(names);
}, 60_000);

test("missingTables lists schema tables the database lacks, in schema order", () => {
  expect(missingTables(["assumptions", "ideas", "moments"], ["ideas", "projects"])).toEqual(["assumptions", "moments"]);
  expect(missingTables(["ideas"], ["ideas"])).toEqual([]);
});
