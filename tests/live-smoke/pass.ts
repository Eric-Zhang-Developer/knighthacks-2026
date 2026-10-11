import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { expect, type APIRequest, type APIRequestContext, type TestInfo } from "@playwright/test";
import { z } from "zod";
import { fieldsSchema } from "@/lib/ideas/contract";

import { versionSchema, cardsSchema, suggestions, directions, resultSchema, CRITERIA } from "./shapes";
import { checkClaims, claim } from "./contracts";
import { startServer } from "./server";

type Entry = { provider: string; route: string; status: number | null; latencyMs: number; response?: unknown; error?: string };
// These are generated prose, not Claim fields; expose the mission-contract gap rather than pretending they are labelled.
export const unlabelledFields = ["interpret: title, description, audience, problem, workflow, constraints", "revision: field, change", "challenge: question, assumption; answer outcome", "branch: title, change", "compare: uncertainty", "alternative: step", "experiment: procedure, observable"];

export async function runPass(provider: "claude" | "gemini", playwright: { request: APIRequest }, info: TestInfo) {
  const entries: Entry[] = [];
  const report: { provider: string; entries: Entry[]; unlabelledFields: string[]; experiment?: string; cleanup?: string; failure?: string } = { provider, entries, unlabelledFields };
  let workspaceId: string | undefined;
  let server: Awaited<ReturnType<typeof startServer>> | undefined;
  let client: APIRequestContext | undefined;
  let failure: string | undefined;
  const deadline = Date.now() + 320000;
  const secrets = [process.env.ANTHROPIC_API_KEY, process.env.GEMINI_API_KEY, process.env.HF_TOKEN, process.env.HF_API_KEY, process.env.DATABASE_URL, process.env.TEST_DATABASE_URL].filter((value): value is string => Boolean(value));
  const sql = neon(process.env.TEST_DATABASE_URL!);
  async function request(route: string, expected: number, data?: unknown, extraHeaders?: Record<string, string>) {
    const entry: Entry = { provider, route, status: null, latencyMs: 0 };
    entries.push(entry);
    const started = performance.now();
    try {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error("Pass deadline");
      const response = await client!.post(route, { headers: { origin: server!.origin, ...extraHeaders }, ...(data === undefined ? {} : { data }), timeout: Math.min(185000, remaining) });
      entry.status = response.status();
      const raw = await response.text();
      if (secrets.some((secret) => raw.includes(secret))) { entry.error = "Response contained a credential; body withheld"; throw new Error(entry.error); }
      try { entry.response = JSON.parse(raw); } catch { entry.error = "Response was not JSON; body withheld"; throw new Error(entry.error); }
      if (entry.status !== expected) throw new Error("Unexpected HTTP status");
      return entry.response;
    } catch {
      entry.error ??= entry.status === null ? "Transport failure or pass deadline" : "Unexpected HTTP status";
      throw new Error(`${provider} ${route}: ${entry.error} (status ${entry.status ?? "unavailable"})`);
    } finally { entry.latencyMs = Math.round(performance.now() - started); }
  }
  try {
    server = await startServer(provider);
    client = await playwright.request.newContext({ baseURL: server.origin });
    const identity = z.object({ workspaceId: z.uuid() }).parse(await request("/api/workspace", 201));
    workspaceId = identity.workspaceId;
    const fields = fieldsSchema.parse(await request("/api/ideas/interpret", 200, { text: "A hackathon meal planner for teammates. The problem is coordinating meals while building. Collect dietary requirements and choose a shared meal. It must use food already available at the event." }));
    const original = versionSchema.parse(await request("/api/ideas", 201, fields, { "Idempotency-Key": randomUUID() }));
    const evidence = cardsSchema.parse(await request(`/api/evidence/${original.versionId}`, 200));
    expect(evidence.cards.map((card) => card.projectId)).toEqual(original.neighborIds.slice(0, 3));
    for (const card of evidence.cards) checkClaims({ overlaps: card.overlaps, differences: card.differences, uncertainty: card.uncertainty }, [card.projectId], new Map([[card.projectId, card.excerpt]]));
    const proposal = suggestions.parse(await request("/api/revisions/propose", 200, { versionId: original.versionId, context: "Suggest a concrete change to help a team test this workflow during a hackathon." }));
    checkClaims(proposal, []);
    const revised = versionSchema.parse(await request(`/api/revisions/${proposal.suggestions[0].id}/accept`, 201));
    expect(revised.parentId).toBe(original.versionId);
    const session = z.object({ sessionId: z.uuid() }).parse(await request("/api/challenge", 201, { versionId: original.versionId, perspective: "judge" }));
    const question = z.object({ round: z.literal(1), question: z.string().trim().min(1), assumption: z.string().trim().min(1), source: claim }).parse(await request(`/api/challenge/${session.sessionId}/round`, 200));
    const sourceRows = await sql`select id, description, tagline, title from projects where corpus_version = ${original.corpusVersion} and id = any(array(select jsonb_array_elements_text(${JSON.stringify(original.neighborIds)}::jsonb)))`;
    const excerpts = new Map<string, string>();
    for (const row of sourceRows) {
      const excerpt = [row.description, row.tagline, row.title].find((text) => typeof text === "string" && text.trim());
      if (typeof excerpt === "string") excerpts.set(String(row.id), excerpt.slice(0, 6000));
    }
    checkClaims(question.source, [...excerpts.keys()], excerpts);
    if (!question.source.sourceIds.length) {
      expect(question.source.label).toBe("unverified");
      expect(question.source.text).toMatch(/^Proposed test:\s*\S/);
    }
    const outcome = z.object({ outcome: z.enum(["revise", "gather evidence", "test", "answered well"]) }).parse(await request(`/api/challenge/${session.sessionId}/answer`, 200, { answer: "We have not validated that assumption. We propose asking two teammates to try choosing a meal and observing whether they can agree; we do not yet have results." }));
    const branching = directions.parse(await request("/api/branches/suggest", 200, { versionId: original.versionId }));
    const branch = versionSchema.parse(await request(`/api/branches/${branching.directions[0].id}/accept`, 201));
    expect(branch.parentId).toBe(original.versionId);
    const compared = resultSchema.parse(await request("/api/compare", 200, { versionIds: [original.versionId, revised.versionId] }));
    expect(compared.criteria.map((criterion) => criterion.name)).toEqual([...CRITERIA]);
    for (const criterion of compared.criteria) {
      expect(criterion.perVersion.map((entry) => entry.versionId)).toEqual([original.versionId, revised.versionId]);
      for (const entry of criterion.perVersion) {
        const cards = entry.versionId === original.versionId ? evidence.cards : [];
        checkClaims(entry.reason, cards.map((card) => card.projectId), new Map(cards.map((card) => [card.projectId, card.excerpt])));
      }
    }
    const alternative = z.object({ versionId: z.uuid(), projectId: z.string(), url: z.url(), title: z.string(), missingWorkflow: z.boolean(), points: z.array(z.object({ step: z.string().min(1), claim })) }).parse(await request(`/api/alternative/${original.versionId}`, 200));
    expect(alternative.projectId).toBe(original.neighborIds[0]);
    expect(alternative.missingWorkflow).toBe(!original.workflow?.trim());
    if (alternative.missingWorkflow) expect(alternative.points).toHaveLength(0);
    else { expect(alternative.points.length).toBeGreaterThanOrEqual(2); expect(alternative.points.length).toBeLessThanOrEqual(4); }
    for (const point of alternative.points) { expect(original.workflow).toContain(point.step); checkClaims(point.claim, [alternative.projectId], excerpts); }
    if (outcome.outcome === "test") {
      const experiment = z.object({ hypothesis: claim, procedure: z.string().min(1), observable: z.string().min(1), result: z.null() }).parse(await request("/api/experiments", 201, { sessionId: session.sessionId, round: 1 }));
      checkClaims(experiment.hypothesis, []); expect(experiment.hypothesis.label).toBe("unverified");
      report.experiment = "Drafted from the real test outcome";
    } else report.experiment = `Not applicable: actual critic outcome was ${outcome.outcome}; no test outcome fabricated`;
    const snapshot = z.object({ snapshotId: z.uuid(), data: z.object({ versionId: z.uuid() }).passthrough() }).parse(await request("/api/snapshots", 201, { versionId: original.versionId }));
    expect(snapshot.data.versionId).toBe(original.versionId); checkClaims(snapshot.data, original.neighborIds);
  } catch (error) {
    // Zod/expect errors may contain provider text. Persist only a route attribution, never the exception payload.
    failure = error instanceof Error && error.message.startsWith(`${provider} /api/`) ? error.message : `${provider}: validation/startup failed after ${entries.at(-1)?.route ?? "server startup"}`;
    report.failure = failure;
  } finally {
    if (workspaceId) {
      try {
        const deleted = await sql`delete from workspaces where id = ${workspaceId}::uuid returning id`;
        if (deleted.length !== 1) throw new Error("Missing owned row");
        report.cleanup = "Deleted exactly the created workspace; dependent rows cascade";
      } catch { report.cleanup = "Own workspace cleanup failed"; failure ??= `${provider}: own workspace cleanup failed`; }
    } else report.cleanup = "No successful workspace creation to clean up";
    try { await client?.dispose(); } catch { failure ??= `${provider}: HTTP context cleanup failed`; }
    try { await server?.stop(); } catch { failure ??= `${provider}: owned server cleanup failed`; }
    report.failure = failure;
    await writeFile(info.outputPath(`${provider}.json`), JSON.stringify(report, null, 2));
  }
  return failure;
}



