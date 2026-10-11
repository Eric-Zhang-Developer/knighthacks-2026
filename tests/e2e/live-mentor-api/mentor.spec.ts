import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";
import { test, expect } from "@playwright/test";
import { callIdFor, type ToolCall } from "../../../lib/mentor/contract";

// Cookies/capabilities must never enter Playwright traces. Receipts contain assertions only.
test.use({ trace: "off" });
const run = promisify(execFile);
function dedicatedDatabase() {
  expect(Boolean(process.env.TEST_DATABASE_URL), "Set the isolated TEST_DATABASE_URL").toBe(true);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must use the same isolated test branch").toBe(true);
  return neon(process.env.TEST_DATABASE_URL!);
}

test("actual Next mentor routes reject unauthorized, foreign-origin, malformed and foreign-session requests", async ({ playwright, baseURL }, info) => {
  test.setTimeout(120_000);
  const sql = dedicatedDatabase();
  if (!baseURL) throw new Error("Verifier base URL is required");
  const origin = new URL(baseURL).origin;
  const headers = { origin };
  const clients = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
  const [owner, stranger, anonymous] = clients;
  const created: string[] = [];
  const checks: { check: string; status: number }[] = [];
  async function status(check: string, response: Awaited<ReturnType<typeof owner.post>>, expected: number) {
    expect(response.status(), check).toBe(expected);
    const body = await response.json() as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["error"]);
    expect(typeof body.error).toBe("string");
    expect(response.headers()["cache-control"]).toContain("no-store");
    checks.push({ check, status: expected });
  }
  async function query<T>(operation: PromiseLike<T>): Promise<T> {
    try { return await operation; }
    catch { throw new Error("Mentor verification test-database query failed; apply the reviewed test schema first."); }
  }
  try {
    await status("anonymous session", await anonymous.post("/api/mentor/session", { headers, data: {} }), 401);
    await status("anonymous tools", await anonymous.post("/api/mentor/tools", { headers, data: {} }), 401);
    await status("anonymous end", await anonymous.delete(`/api/mentor/session/${randomUUID()}`, { headers }), 401);
    const identities: { workspaceId: string; memberId: string }[] = [];
    for (const client of [owner, stranger]) {
      const response = await client.post("/api/workspace", { headers });
      expect(response.status()).toBe(201);
      const identity = await response.json();
      created.push(identity.workspaceId);
      identities.push(identity);
    }
    await status("foreign origin", await owner.post("/api/mentor/session", { headers: { origin: "https://foreign.invalid" }, data: {} }), 403);
    await status("browser agent override", await owner.post("/api/mentor/session", { headers, data: { agentId: "agent_untrusted" } }), 400);
    await status("unknown tool", await owner.post("/api/mentor/tools", { headers, data: { tool: "fetch_url", args: { url: "https://foreign.invalid" } } }), 400);
    await status("invalid JSON", await owner.post("/api/mentor/tools", { headers: { ...headers, "content-type": "application/json" }, data: "{" }), 400);
    await status("oversized body", await owner.post("/api/mentor/tools", { headers, data: { text: "x".repeat(16 * 1024) } }), 413);
    const before = await query(sql`select count(*)::int as count from mentor_sessions where workspace_id=${identities[0].workspaceId}::uuid`);
    expect(before[0].count, "Guard failures must not reserve a provider session").toBe(0);

    // A test-owned DB session exercises HTTP tool authorization without minting a provider token.
    const sessionId = randomUUID();
    await query(sql`insert into mentor_sessions(id,workspace_id,member_id,expires_at) values (${sessionId}::uuid,${identities[0].workspaceId}::uuid,${identities[0].memberId}::uuid,now()+interval '20 minutes')`);
    const baseCall = { sessionId, turnId: 0, tool: "get_context" as const, args: {} };
    const call = { ...baseCall, callId: callIdFor(baseCall) };
    await status("foreign session tool", await stranger.post("/api/mentor/tools", { headers, data: call }), 404);
    await status("foreign session end", await stranger.delete(`/api/mentor/session/${sessionId}`, { headers }), 404);
    await status("call digest mismatch", await owner.post("/api/mentor/tools", { headers, data: { ...call, callId: "0".repeat(64) } }), 409);
    const context = await owner.post("/api/mentor/tools", { headers, data: call });
    expect(context.status()).toBe(200);
    const contextBody = await context.json();
    expect(contextBody).toMatchObject({ sessionId, turnId: 0, callId: call.callId, tool: "get_context" });
    const replay = await owner.post("/api/mentor/tools", { headers, data: call });
    expect(replay.status()).toBe(200);
    expect(await replay.json()).toEqual(contextBody);
    const end = await owner.delete(`/api/mentor/session/${sessionId}`, { headers });
    expect(end.status()).toBe(200);
    expect((await owner.delete(`/api/mentor/session/${sessionId}`, { headers })).status()).toBe(200);
    await status("ended session cannot replay", await owner.post("/api/mentor/tools", { headers, data: call }), 409);
    const body = JSON.stringify({ mode: "actual-next-http-and-test-database", providerTokenRequests: 0, checks, contextRoundTrip: true, exactReplay: true, endIdempotent: true, gaps: ["No live ElevenLabs conversation", "No human audio acceptance", "No embedding retrieval or save confirmation exercised by this guard test"] }, null, 2);
    await writeFile(info.outputPath("mentor-http-receipt.json"), body);
    await info.attach("mentor-http-receipt", { body, contentType: "application/json" });
  } finally {
    const cleanup = await Promise.allSettled(created.map((id) => sql`delete from workspaces where id=${id}::uuid`));
    await Promise.allSettled(clients.map((client) => client.dispose()));
    if (cleanup.some((result) => result.status === "rejected")) throw new Error("Cleanup failed for a mentor test-owned workspace");
  }
});

test("actual PostgreSQL serializes session and tool budgets, replay and end races", async ({}, info) => {
  test.setTimeout(210_000);
  dedicatedDatabase();
  let stdout: string;
  try {
    ({ stdout } = await run(process.execPath, [join(__dirname, "store-runner.mjs")], { timeout: 195_000, env: process.env, windowsHide: true }));
  } catch (error) {
    // The runner emits only a sanitized phase marker; discard child process metadata/environment.
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    throw new Error(`Mentor database acceptance failed: ${stderr || "runner unavailable"}`);
  }
  const result = JSON.parse(stdout);
  expect(result.mode).toBe("actual-test-database");
  expect(result.providerCalls).toBe(0);
  expect(result.checks).toHaveLength(9);
  expect(result.cleanup).toBe("all test workspaces removed");
  const body = JSON.stringify(result, null, 2);
  await writeFile(info.outputPath("mentor-store-receipt.json"), body);
  await info.attach("mentor-store-receipt", { body, contentType: "application/json" });
});

test("real corpus retrieval grounds an unsaved proposal and only explicit duplicate-safe confirmation persists it", async ({ playwright, baseURL }, info) => {
  test.setTimeout(210_000);
  const sql = dedicatedDatabase();
  if (!baseURL) throw new Error("Verifier base URL is required");
  const origin = new URL(baseURL).origin, headers = { origin };
  const owner = await playwright.request.newContext({ baseURL: origin });
  let workspaceId: string | undefined;
  async function query<T>(operation: PromiseLike<T>): Promise<T> {
    try { return await operation; }
    catch { throw new Error("Mentor grounded-flow test-database query failed"); }
  }
  async function counts() {
    const rows = await query(sql`select count(distinct i.id)::int as ideas,count(v.id)::int as versions from ideas i left join idea_versions v on v.idea_id=i.id where i.workspace_id=${workspaceId}::uuid`);
    return rows[0];
  }
  try {
    const created = await owner.post("/api/workspace", { headers });
    expect(created.status()).toBe(201);
    const identity = await created.json();
    workspaceId = identity.workspaceId;
    const sessionId = randomUUID();
    await query(sql`insert into mentor_sessions(id,workspace_id,member_id,expires_at) values (${sessionId}::uuid,${workspaceId}::uuid,${identity.memberId}::uuid,now()+interval '20 minutes')`);
    const make = <T extends Omit<ToolCall, "callId">>(call: T) => ({ ...call, callId: callIdFor(call) });
    const searchQuery = "Help hackathon teammates plan shared meals. Collect dietary constraints and choose a meal together, so the team can keep building.";
    const searchCall = make({ sessionId, turnId: 1, tool: "find_projects" as const, args: { query: searchQuery } });
    const search = await owner.post("/api/mentor/tools", { headers, data: searchCall });
    expect(search.status(), "Requires real HF embeddings and the synced test corpus").toBe(200);
    const searched = await search.json();
    expect(searched).toMatchObject({ sessionId, turnId: 1, callId: searchCall.callId, tool: "find_projects" });
    expect(searched.data.query).toBe(searchQuery);
    type Project = { projectId: string; title: string; url: string; excerpt: string; corpusVersion: string };
    const projects = searched.data.projects as Project[];
    expect(projects.length).toBeGreaterThan(0);
    expect(projects.length).toBeLessThanOrEqual(5);
    expect(searched.data.sourceIds).toEqual(projects.map((project) => project.projectId));
    for (const project of projects) {
      const rows = await query(sql`select id,title,url,description,tagline,corpus_version from projects where id=${project.projectId}`);
      expect(rows).toHaveLength(1);
      expect(project).toMatchObject({ projectId: rows[0].id, title: rows[0].title, url: rows[0].url, corpusVersion: rows[0].corpus_version });
      const text = [rows[0].description, rows[0].tagline, rows[0].title].find((value) => typeof value === "string" && value.trim()) as string;
      expect(project.excerpt).toBe(text.slice(0, 6000));
    }
    const fields = { title: "Shared meals for hackathon teammates", description: searchQuery, audience: "Hackathon teammates", problem: "Coordinate meals while the team builds", workflow: "Collect dietary constraints and choose a meal together", constraints: null };
    const proposalCall = make({ sessionId, turnId: 2, tool: "propose_idea" as const, args: {
      fields, rationale: "Explore the shared meal workflow while keeping the retrieved projects visible for comparison.", sourceIds: projects.map((project) => project.projectId),
    } });
    const before = await counts();
    expect(before).toEqual({ ideas: 0, versions: 0 });
    const proposed = await owner.post("/api/mentor/tools", { headers, data: proposalCall });
    expect(proposed.status()).toBe(200);
    const proposal = await proposed.json();
    expect(proposal.data).toMatchObject({ status: "pending_confirmation", fields, sourceIds: proposalCall.args.sourceIds });
    const duplicateProposal = await owner.post("/api/mentor/tools", { headers, data: proposalCall });
    expect(duplicateProposal.status()).toBe(200);
    expect(await duplicateProposal.json()).toEqual(proposal);
    expect(await counts(), "Retrieval and proposal must leave idea/version counts unchanged").toEqual(before);

    // Models cannot call this operation. This request represents the explicit Confirm UI action.
    const key = randomUUID();
    const save = await owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": key }, data: proposal.data.fields });
    expect(save.status()).toBe(201);
    const saved = await save.json();
    expect(saved).toMatchObject({ ...fields, parentId: null });
    const duplicateSave = await owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": key }, data: proposal.data.fields });
    expect(duplicateSave.status()).toBe(200);
    expect(await duplicateSave.json()).toEqual(saved);
    expect(await counts()).toEqual({ ideas: 1, versions: 1 });
    const contextCall = make({ sessionId, turnId: 3, tool: "get_context" as const, args: { versionId: saved.versionId } });
    const context = await owner.post("/api/mentor/tools", { headers, data: contextCall });
    expect(context.status()).toBe(200);
    const grounded = await context.json();
    expect(grounded.data.saved).toMatchObject({ versionId: saved.versionId, fields });
    expect(Object.keys(grounded.data).sort()).toEqual(["criteria", "saved", "sourceIds", "tracks"]);
    expect(Object.keys(grounded.data.saved).sort()).toEqual(["corpusVersion", "evidence", "fields", "versionId"]);
    const receipt = JSON.stringify({ mode: "actual-http-hf-neon", providerVoiceCalls: 0, query: searchQuery,
      sources: projects.map(({ title, url, corpusVersion }) => ({ title, url, corpusVersion })),
      proposalStatus: proposal.data.status, beforeConfirmation: before, afterConfirmation: { ideas: 1, versions: 1 },
      saveStatuses: [save.status(), duplicateSave.status()], exactReplay: true, savedContextMatches: true,
      gaps: ["Confirmation HTTP operation verified; human UI confirmation and live voice remain separate acceptance"] }, null, 2);
    await writeFile(info.outputPath("mentor-grounded-confirmation-receipt.json"), receipt);
    await info.attach("mentor-grounded-confirmation-receipt", { body: receipt, contentType: "application/json" });
  } finally {
    await owner.dispose();
    if (workspaceId) await query(sql`delete from workspaces where id=${workspaceId}::uuid`);
  }
});
