// Executes the actual store on the isolated test database. No provider boundary is invoked.
// Like the ai-client verifier, transpile using the pinned compiler and replace only Next's build marker.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { neon } from "@neondatabase/serverless";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  const path = file.endsWith(".ts") ? file : `${file}.ts`;
  if (cache.has(path)) return cache.get(path).exports;
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const ownedModule = { exports: {} };
  cache.set(path, ownedModule);
  const localRequire = (name) => {
    if (name === "next/dist/compiled/server-only") return {};
    if (name.startsWith("@/")) return load(resolve(root, name.slice(2)));
    if (name.startsWith(".")) return load(resolve(dirname(path), name));
    return require(name);
  };
  new Function("require", "module", "exports", compiled)(localRequire, ownedModule, ownedModule.exports);
  return ownedModule.exports;
}

const owned = [];
let sql;
let phase = "test-database-guard";
let failed = false;
const receipt = { mode: "actual-test-database", providerCalls: 0, checks: [] };
try {
  assert(process.env.TEST_DATABASE_URL && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL);
  sql = neon(process.env.TEST_DATABASE_URL);
  phase = "schema-preflight";
  const tables = await sql`select to_regclass('public.mentor_sessions')::text as sessions, to_regclass('public.mentor_budgets')::text as budgets`;
  assert(tables[0].sessions && tables[0].budgets, "Root must apply the reviewed additive test schema first");
  const store = load(resolve(root, "lib/mentor/store.ts"));
  const { callIdFor } = load(resolve(root, "lib/mentor/contract.ts"));
  async function workspace() {
    const workspaceId = randomUUID(), memberId = randomUUID(), secondId = randomUUID();
    await sql`insert into workspaces(id,member_count) values (${workspaceId}::uuid,2)`;
    owned.push(workspaceId);
    await sql`insert into members(id,workspace_id,seat,session_hash) values (${memberId}::uuid,${workspaceId}::uuid,1,${randomUUID()}),(${secondId}::uuid,${workspaceId}::uuid,2,${randomUUID()})`;
    return [{ workspaceId, memberId }, { workspaceId, memberId: secondId }];
  }
  const [owner, teammate] = await workspace();
  const [stranger] = await workspace();
  const makeCall = (sessionId, turnId, index = 0) => {
    const call = { sessionId, turnId, tool: "find_projects", args: { query: `fixture query ${index}` } };
    return { ...call, callId: callIdFor(call) };
  };
  function statuses(results, count, status = 429) {
    assert.equal(results.filter((r) => r.status === "fulfilled").length, count);
    for (const result of results.filter((r) => r.status === "rejected")) assert.equal(result.reason.status, status);
  }
  phase = "member-issuance-race";
  const issued = await Promise.allSettled(Array.from({ length: 10 }, () => store.reserveSession(owner)));
  statuses(issued, 3);
  const sessions = issued.filter((r) => r.status === "fulfilled").map((r) => r.value);
  receipt.checks.push({ check: phase, attempted: 10, allowed: 3 });

  phase = "workspace-issuance-race";
  const [budgetOwner, budgetTeammate] = await workspace();
  // Ten genuine-shaped older reservations consume hourly budget, but not the ten-minute member budget.
  await sql`insert into mentor_budgets(workspace_id,events) select ${budgetOwner.workspaceId}::uuid,jsonb_agg(jsonb_build_object('memberId',${budgetOwner.memberId}::text,'at',extract(epoch from now()-interval '20 minutes'))) from generate_series(1,10)`;
  const hourly = await Promise.allSettled(Array.from({ length: 8 }, (_, index) => store.reserveSession(index % 2 ? budgetOwner : budgetTeammate)));
  statuses(hourly, 2);
  receipt.checks.push({ check: phase, olderReservations: 10, attempted: 8, allowed: 2 });

  phase = "session-ownership";
  const call = makeCall(sessions[0], 0);
  for (const foreign of [stranger, teammate]) {
    await assert.rejects(store.reserveTool(foreign, call), { status: 404 });
    await assert.rejects(store.endSession(foreign, sessions[0]), { status: 404 });
  }
  receipt.checks.push({ check: phase, crossWorkspaceAndMemberDenied: true });

  phase = "tool-duplicate-and-replay";
  const duplicate = await Promise.all(Array.from({ length: 12 }, () => store.reserveTool(owner, call)));
  assert.equal(duplicate.filter((r) => r.status === "run").length, 1);
  assert.equal(duplicate.filter((r) => r.status === "pending").length, 11);
  const data = { query: call.args.query, projects: [], sourceIds: [], status: "ready" };
  await store.completeTool(owner, call, data);
  assert.deepEqual(await store.reserveTool(owner, call), { status: "replay", data });
  await assert.rejects(store.reserveTool(owner, { ...call, args: { query: "different body" } }), { status: 409 });
  receipt.checks.push({ check: phase, attempted: 12, executions: 1, pending: 11, replayExact: true, mismatchDenied: true });

  phase = "per-turn-tool-cap";
  const turn = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => store.reserveTool(owner, makeCall(sessions[0], 1, index))));
  statuses(turn, 8);
  receipt.checks.push({ check: phase, attempted: 12, allowed: 8 });

  phase = "per-session-tool-cap";
  const total = await Promise.allSettled(Array.from({ length: 48 }, (_, index) => store.reserveTool(owner, makeCall(sessions[1], Math.floor(index / 8), index))));
  statuses(total, 40);
  receipt.checks.push({ check: phase, attempted: 48, allowed: 40 });

  phase = "end-during-tool";
  const slow = makeCall(sessions[2], 0);
  assert.equal((await store.reserveTool(owner, slow)).status, "run");
  await store.endSession(owner, sessions[2]);
  await store.endSession(owner, sessions[2]);
  await assert.rejects(store.completeTool(owner, slow, data), { status: 409 });
  await assert.rejects(store.reserveTool(owner, slow), { status: 409 });
  const completed = await sql`select calls->${slow.callId}->>'status' as status from mentor_sessions where id=${sessions[2]}::uuid`;
  assert.equal(completed[0].status, "pending");
  receipt.checks.push({ check: phase, endedIdempotently: true, latePublicationDenied: true });

  phase = "expired-session";
  await sql`update mentor_sessions set created_at=now()-interval '21 minutes', expires_at=now()-interval '1 minute' where id=${sessions[0]}::uuid`;
  await assert.rejects(store.reserveTool(owner, makeCall(sessions[0], 9)), { status: 409 });
  await assert.rejects(store.completeTool(owner, call, data), { status: 409 });
  receipt.checks.push({ check: phase, reservationAndPublicationDenied: true });

  phase = "no-application-mutations";
  const writes = await sql`select count(*)::int as count from ideas where workspace_id=any(${owned}::uuid[])`;
  assert.equal(writes[0].count, 0);
  receipt.checks.push({ check: phase, ideasCreated: 0 });
} catch {
  failed = true;
  process.stderr.write(JSON.stringify({ failedPhase: phase, error: "Mentor acceptance failed; no provider or database diagnostics retained." }));
} finally {
  const cleanup = await Promise.allSettled(owned.map((id) => sql`delete from workspaces where id=${id}::uuid`));
  if (cleanup.some((r) => r.status === "rejected")) {
    failed = true;
    process.stderr.write("Mentor test cleanup failed for an explicitly created workspace.");
  }
}
if (failed) process.exitCode = 1;
else process.stdout.write(JSON.stringify({ ...receipt, cleanup: "all test workspaces removed" }));
