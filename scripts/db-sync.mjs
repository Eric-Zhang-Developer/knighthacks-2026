// Additive-only schema sync (specs/features/db-sync): `node --env-file=.env.local scripts/db-sync.mjs [--apply]`.
// Creates the tables, foreign keys and indexes db/schema/ defines and DATABASE_URL lacks. It never drops, alters a
// column or touches an existing object: `drizzle-kit push` would drop any table this checkout has no file for (#125).
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const statements = (sql) =>
  sql.split(/;\s*(?:--> statement-breakpoint)?\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);

// Only three shapes can ever reach the plan; anything else (a DROP, an ALTER COLUMN, an extension) is "other".
export function classify(sql) {
  let m;
  if ((m = /^CREATE TABLE "([^"]+)" \(([\s\S]*)\)$/.exec(sql)))
    return { kind: "table", name: m[1], columns: [...m[2].matchAll(/^\s*"([^"]+)"/gm)].map((c) => c[1]), sql };
  if ((m = /^CREATE (?:UNIQUE )?INDEX "([^"]+)" ON "([^"]+)"/.exec(sql))) return { kind: "index", name: m[1], sql };
  if ((m = /^ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" FOREIGN KEY \(([^)]*)\) REFERENCES "public"\."([^"]+)"/.exec(sql)))
    return { kind: "fk", name: m[2], key: fkKey(m[1], m[3].replaceAll('"', "").split(","), m[4]), sql };
  return { kind: "other", sql };
}

// A foreign key is matched by what it does, not its name: hand-written SQL on the test branch made the same keys
// under Postgres's default names (votes_member_id_fkey), and adding them again would duplicate each one.
export const fkKey = (table, columns, references) => `${table}(${columns.map((c) => c.trim()).join(",")})->${references}`;

// live: { columns: Map<table, Set<column>>, indexes: Set<name>, foreignKeys: Set<fkKey> }
export function plan(parsed, live) {
  const apply = [], drift = [];
  for (const s of parsed) {
    if (s.kind === "table") {
      const have = live.columns.get(s.name);
      if (!have) apply.push(s);
      else for (const c of s.columns) if (!have.has(c)) drift.push(`${s.name}.${c}`);
    } else if (s.kind === "fk" && !live.foreignKeys.has(s.key)) apply.push(s);
    else if (s.kind === "index" && !live.indexes.has(s.name)) apply.push(s);
  }
  const order = { table: 0, fk: 1, index: 2 };
  return { apply: apply.sort((a, b) => order[a.kind] - order[b.kind]), drift };
}

const label = (s) => `${{ table: "create table", fk: "add foreign key", index: "create index" }[s.kind]} ${s.name}`;

function refuse(message) {
  process.stderr.write(`db-sync: ${message}\n`);
  process.exit(2);
}

async function main(argv) {
  if (!process.env.DATABASE_URL) refuse("DATABASE_URL is not set (see .env.example)");
  // The shared test branch takes a feature branch's new tables (the safe replacement for hand-written SQL, #125).
  // Every other target, production included, only gets main's schema from a clean checkout.
  const test = process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
  if (!test) {
    const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
    if (git("status", "--porcelain")) refuse("refusing: the checkout has uncommitted changes");
    if (git("rev-parse", "HEAD") !== git("rev-parse", "origin/main"))
      refuse("refusing: HEAD is not origin/main (git fetch origin, then check out origin/main)");
  }
  process.stdout.write(`db-sync: target ${test ? "TEST_DATABASE_URL" : "DATABASE_URL"}\n`);

  const exported = execFileSync(process.execPath, [join(ROOT, "node_modules/drizzle-kit/bin.cjs"), "export", "--sql"], { cwd: ROOT, encoding: "utf8" });
  const { Pool } = await import("@neondatabase/serverless");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const columns = new Map();
    for (const r of (await client.query("select table_name, column_name from information_schema.columns where table_schema = 'public'")).rows)
      columns.set(r.table_name, (columns.get(r.table_name) ?? new Set()).add(r.column_name));
    const names = async (q) => new Set((await client.query(q)).rows.map((r) => r.name));
    const fks = await client.query(`select c.conrelid::regclass::text as tbl, c.confrelid::regclass::text as ref,
        array(select a.attname::text from unnest(c.conkey) with ordinality as k(n, o)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n order by k.o) as cols
      from pg_constraint c join pg_namespace ns on ns.oid = c.connamespace where c.contype = 'f' and ns.nspname = 'public'`);
    const live = {
      columns,
      indexes: await names("select indexname as name from pg_indexes where schemaname = 'public'"),
      foreignKeys: new Set(fks.rows.map((r) => fkKey(r.tbl, r.cols, r.ref))),
    };
    const { apply, drift } = plan(statements(exported).map(classify), live);
    for (const s of apply) process.stdout.write(`${label(s)}\n`);
    for (const d of drift) process.stdout.write(`drift: ${d}\n`);
    if (drift.length) refuse(`${drift.length} drifted column(s); nothing applied`);
    if (!apply.length) return void process.stdout.write("db-sync: nothing to apply\n");
    if (!argv.includes("--apply")) return void process.stdout.write(`db-sync: ${apply.length} statement(s) planned; rerun with --apply\n`);
    await client.query("begin");
    try {
      // drizzle-kit doesn't create extensions; vector columns need pgvector first (as scripts/db-setup.mjs does).
      await client.query("create extension if not exists vector");
      for (const s of apply) await client.query(s.sql);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
    process.stdout.write(`db-sync: applied ${apply.length} statement(s)\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main(process.argv.slice(2));
