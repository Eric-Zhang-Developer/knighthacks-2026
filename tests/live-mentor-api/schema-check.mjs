import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const tables = ["mentor_budgets", "mentor_sessions"];
const columns = {
  mentor_budgets: { workspace_id: ["uuid", false, null], events: ["jsonb", false, "'[]'::jsonb"] },
  mentor_sessions: {
    id: ["uuid", false, null], workspace_id: ["uuid", false, null], member_id: ["uuid", false, null],
    created_at: ["timestamptz", false, "now()"], expires_at: ["timestamptz", false, null],
    ended_at: ["timestamptz", true, null], calls: ["jsonb", false, "'{}'::jsonb"], source_ids: ["jsonb", false, "'[]'::jsonb"],
  },
};
const checks = {
  mentor_budgets: { mentor_budget_bound: "jsonb_typeof(events) = 'array' and jsonb_array_length(events) <= 12 and octet_length(events::text) <= 4096" },
  mentor_sessions: {
    mentor_session_duration: "expires_at > created_at and expires_at <= created_at + interval '2 hours'",
    mentor_calls_bound: "jsonb_typeof(calls) = 'object' and octet_length(calls::text) <= 6291456",
    mentor_sources_bound: "jsonb_typeof(source_ids) = 'array' and jsonb_array_length(source_ids) <= 200 and octet_length(source_ids::text) <= 10000",
  },
};
const foreignKeys = {
  mentor_budgets: ["workspace_id:public.workspaces:id"],
  mentor_sessions: ["workspace_id:public.workspaces:id", "member_id:public.members:id"],
};

// pg_get_constraintdef adds grouping/casts and canonicalizes the interval. Keep all operators,
// literals and their order: a changed bound, OR, omitted clause, or different column must fail.
function normalizedCheck(value) {
  return value.toLowerCase().replace(/^check\s*/i, "")
    .replace(/interval\s*'2 hours'|'(?:02:00:00|2 hours)'::interval/g, "duration2hours")
    .replace(/::text/g, "").replace(/[\s()\"]/g, "");
}
function normalizedDefault(value) { return value?.replace(/[\s()]/g, "").toLowerCase() ?? null; }

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply") || args.length > 1) throw new Error("Usage: node tests/live-mentor-api/schema-check.mjs [--apply]");
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is required; DATABASE_URL is never used.");
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error("TEST_DATABASE_URL must be a PostgreSQL connection URL."); }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) throw new Error("TEST_DATABASE_URL must be a PostgreSQL connection URL.");
  const database = neon(url);
  if (args.includes("--apply")) {
    const decision = await readFile(new URL("../../specs/decisions/live-mentor-api-schema.md", import.meta.url), "utf8");
    const blocks = [...decision.matchAll(/```sql\r?\n([\s\S]*?)```/g)];
    if (blocks.length !== 1) throw new Error("Schema decision must contain exactly one SQL block.");
    const statements = blocks[0][1].split(";").map((statement) => statement.trim()).filter(Boolean);
    // ON DELETE CASCADE is the only permitted DELETE token in the reviewed CREATE statements.
    const safe = statements.length === 2 && statements.every((statement, index) =>
      statement.startsWith(`CREATE TABLE IF NOT EXISTS public.${tables[index]} (`) &&
      !/\b(?:alter|drop|truncate|delete|update|insert|grant|revoke|do|execute)\b/i.test(statement.replace(/ON DELETE CASCADE/g, "")));
    if (!safe) throw new Error("Decision SQL is not the reviewed two additive CREATE TABLE statements.");
    await database.transaction(statements.map((statement) => database.query(statement)));
    process.stdout.write("Applied the two additive mentor CREATE TABLE statements to TEST_DATABASE_URL.\n");
  }
  const [actualColumns, constraints] = await database.transaction([
    database.query(`select table_name, column_name, udt_name, is_nullable, column_default, is_generated, is_identity
      from information_schema.columns where table_schema = 'public' and table_name = any($1::text[])`, [tables]),
    database.query(`select rel.relname as table_name, c.conname as name, c.contype as type, c.convalidated as validated,
      c.condeferrable as "deferrable", c.confdeltype as delete_action, c.confupdtype as update_action, c.confmatchtype as match_type,
      pg_get_constraintdef(c.oid) as definition,
      array(select a.attname::text from unnest(c.conkey) with ordinality k(attnum, n)
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum order by k.n) as columns,
      target.relname as target_table, target_ns.nspname as target_schema,
      array(select a.attname::text from unnest(c.confkey) with ordinality k(attnum, n)
        join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum order by k.n) as target_columns
      from pg_constraint c join pg_class rel on rel.oid = c.conrelid join pg_namespace ns on ns.oid = rel.relnamespace
      left join pg_class target on target.oid = c.confrelid left join pg_namespace target_ns on target_ns.oid = target.relnamespace
      where ns.nspname = 'public' and rel.relname = any($1::text[])`, [tables]),
  ], { readOnly: true });
  const failures = [];
  for (const table of tables) {
    const found = actualColumns.filter((column) => column.table_name === table);
    if (found.length !== Object.keys(columns[table]).length) failures.push(`${table}: missing or unexpected columns`);
    for (const [name, [type, nullable, defaultValue]] of Object.entries(columns[table])) {
      const column = found.find((item) => item.column_name === name);
      if (!column || column.udt_name !== type || (column.is_nullable === "YES") !== nullable ||
        normalizedDefault(column.column_default) !== normalizedDefault(defaultValue) || column.is_generated !== "NEVER" || column.is_identity !== "NO") {
        failures.push(`${table}.${name}: type, nullability, default, or generation differs`);
      }
    }
    const foundConstraints = constraints.filter((constraint) => constraint.table_name === table);
    const primary = foundConstraints.filter((constraint) => constraint.type === "p");
    if (primary.length !== 1 || primary[0].columns.join(",") !== (table === "mentor_budgets" ? "workspace_id" : "id") || primary[0].deferrable || !primary[0].validated) failures.push(`${table}: primary key differs`);
    const actualFks = foundConstraints.filter((constraint) => constraint.type === "f");
    const expectedFks = foreignKeys[table];
    const actualFkKeys = actualFks.map((constraint) => `${constraint.columns.join(",")}:${constraint.target_schema}.${constraint.target_table}:${constraint.target_columns.join(",")}`).sort();
    if (JSON.stringify(actualFkKeys) !== JSON.stringify([...expectedFks].sort()) || actualFks.some((constraint) =>
      !constraint.validated || constraint.deferrable || constraint.delete_action !== "c" || constraint.update_action !== "a" || constraint.match_type !== "s")) failures.push(`${table}: foreign key or cascade differs`);
    for (const [name, expression] of Object.entries(checks[table])) {
      const constraint = foundConstraints.find((item) => item.type === "c" && item.name === name);
      if (!constraint || !constraint.validated || normalizedCheck(constraint.definition) !== normalizedCheck(expression)) failures.push(`${table}.${name}: check constraint differs`);
    }
    // PostgreSQL 18 can expose NOT NULL constraints separately; columns above already verify them.
    const relevant = foundConstraints.filter((constraint) => constraint.type !== "n");
    if (relevant.length !== 1 + expectedFks.length + Object.keys(checks[table]).length) failures.push(`${table}: unexpected constraints`);
  }
  if (failures.length) throw new Error(`Mentor schema mismatch:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.stdout.write("PASS: mentor schema columns, defaults, primary keys, cascading foreign keys, and checks match.\n");
}

main().catch((error) => {
  // Never print database/provider exceptions containing connection strings or capabilities.
  const message = error instanceof Error ? error.message : "";
  const known = /^(Usage:|TEST_DATABASE_URL|Schema decision|Decision SQL|Mentor schema mismatch:)/.test(message);
  const code = typeof error?.code === "string" && /^[A-Z0-9]{5}$/.test(error.code) ? ` SQLSTATE=${error.code}` : "";
  const position = typeof error?.position === "string" && /^\d+$/.test(error.position) ? ` position=${error.position}` : "";
  process.stderr.write((known ? message : `Mentor schema check failed while accessing the isolated database; connection details were withheld.${code}${position}`) + "\n");
  process.exitCode = 1;
});
