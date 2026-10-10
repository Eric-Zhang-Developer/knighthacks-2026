import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import type { Claim } from "@/lib/ai/claims";

type Question = { round: number; question: string; assumption: string; source: Claim };
test.use({ trace: "off" }); // Session cookies must not enter verifier reports.

test("ground three rounds, persist outcomes, reject concurrent work and recover a rejected question without creating versions", async ({ playwright, baseURL }, info) => {
  test.setTimeout(210_000);
  expect(Boolean(process.env.TEST_DATABASE_URL)).toBe(true);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must use the dedicated test branch").toBe(true);
  const fixtureRoot = process.env.AI_STUB_DIR;
  expect(Boolean(fixtureRoot) && isAbsolute(fixtureRoot!)).toBe(true);
  expect(process.env.AI_STUB_ALLOW).toBe("1");
  if (!baseURL || !fixtureRoot) throw new Error("Verifier URL and fresh fixture directory required");
  const sql = neon(process.env.TEST_DATABASE_URL!);
  async function query<T>(operation: PromiseLike<T>): Promise<T> {
    try { return await operation; }
    catch { throw new Error("Challenge verification query failed on the test database"); }
  }
  async function session(id: string) {
    const rows = await query(sql`select to_jsonb(s) as row from challenge_sessions s where id = ${id}::uuid`);
    expect(rows).toHaveLength(1); return rows[0].row;
  }
  async function rounds(id: string) {
    return query(sql`select to_jsonb(r) as row from challenge_rounds r where session_id = ${id}::uuid order by round`);
  }
  async function versions(ideaId: string) {
    return query(sql`select id, md5(to_jsonb(v)::text) as fingerprint from idea_versions v where idea_id = ${ideaId}::uuid order by id`);
  }
  const origin = new URL(baseURL).origin, headers = { origin };
  const clients = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
  const [owner, stranger, anonymous] = clients;
  const createdWorkspaces = new Set<string>(), createdFixtures = new Set<string>();
  let retainedWorkspace: string | undefined;
  async function fixture(key: string, value: unknown) {
    const path = join(fixtureRoot!, `${key}.json`);
    await writeFile(path, JSON.stringify(value), { flag: createdFixtures.has(path) ? "w" : "wx" });
    createdFixtures.add(path);
  }
  try {
    const workspaceIds: string[] = [];
    for (const client of [owner, stranger]) {
      const response = await client.post("/api/workspace", { headers });
      expect(response.status()).toBe(201);
      const { workspaceId } = await response.json();
      expect(workspaceId).toMatch(/^[a-f0-9-]{36}$/i);
      createdWorkspaces.add(workspaceId); workspaceIds.push(workspaceId);
    }
    const idea = await owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: {
      title: "Hackathon meal coordination", description: "Help teammates choose shared meals that meet dietary requirements.", audience: "Hackathon teammates", problem: "Meal coordination interrupts building", workflow: "Collect requirements and choose a shared meal", constraints: null,
    } });
    expect(idea.status(), "Requires real HF embeddings and current test schema").toBe(201);
    const version = await idea.json();
    const originalVersions = await versions(version.ideaId);
    expect(originalVersions).toHaveLength(1);
    const records = await query(sql`select id, title, description, tagline from projects where id = ${version.neighborIds[0]}`);
    expect(records).toHaveLength(1);
    const record = records[0];
    const excerpt = [record.description, record.tagline, record.title].find((value) => typeof value === "string" && value.trim()) as string;
    const quote = excerpt.trim().slice(0, 120);
    expect(quote.length).toBeGreaterThan(0);
    const grounded = { question: "How would your team check whether the proposed meal selection step helps them decide?", assumption: "Teammates can agree on a shared meal using the proposed selection step.", source: { text: quote, label: "supported", sourceIds: [record.id] }, test: null };
    const proposedTest = { question: "What would you measure in a short meal-selection trial?", assumption: "A short trial can reveal whether the workflow supports a shared decision.", source: { text: "Unverified until tested.", label: "unverified", sourceIds: [] }, test: "Run a ten-minute meal-selection trial with teammates and record where a decision stalls." };
    for (const round of [1, 2, 3]) {
      await fixture(`challenge-round-${round}`, round === 2 ? proposedTest : grounded);
      await fixture(`challenge-answer-${round}`, { outcome: round === 1 ? "revise" : round === 2 ? "test" : "answered well" });
    }
    const startData = { versionId: version.versionId, perspective: "judge" };
    expect((await anonymous.post("/api/challenge", { headers, data: startData })).status()).toBe(401);
    expect((await stranger.post("/api/challenge", { headers, data: startData })).status()).toBe(404);
    async function start() {
      const response = await owner.post("/api/challenge", { headers, data: startData });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body).toMatchObject(startData); expect(body.sessionId).toMatch(/^[a-f0-9-]{36}$/i);
      return body.sessionId as string;
    }
    const primary = await start(), endpoint = `/api/challenge/${primary}`;
    expect((await stranger.post(`${endpoint}/round`, { headers })).status()).toBe(404);
    expect((await stranger.post(`${endpoint}/answer`, { headers, data: { answer: "A test answer" } })).status()).toBe(404);
    expect((await owner.post(`${endpoint}/answer`, { headers, data: { answer: "No question yet" } })).status()).toBe(409);
    const questions: Question[] = [], outcomes: string[] = [];
    for (const round of [1, 2, 3]) {
      const response = await owner.post(`${endpoint}/round`, { headers });
      expect(response.status()).toBe(200);
      const question = await response.json() as Question;
      expect(Object.keys(question).sort()).toEqual(["assumption", "question", "round", "source"]);
      expect(question.round).toBe(round); expect(question.assumption.trim()).not.toBe("");
      if (round === 2) expect(question.source).toEqual({ text: `Proposed test: ${proposedTest.test}`, label: "unverified", sourceIds: [] });
      else {
        expect(question.source).toEqual(grounded.source);
        expect(excerpt).toContain(question.source.text);
      }
      questions.push(question);
      const beforeDuplicate = await rounds(primary);
      expect((await owner.post(`${endpoint}/round`, { headers })).status()).toBe(409);
      expect(await rounds(primary)).toEqual(beforeDuplicate);
      const answer = await owner.post(`${endpoint}/answer`, { headers, data: { answer: "We will run a short trial and use the observed result to decide the next change." } });
      expect(answer.status()).toBe(200);
      const outcome = await answer.json();
      expect(outcome).toEqual({ outcome: round === 1 ? "revise" : round === 2 ? "test" : "answered well" });
      outcomes.push(outcome.outcome);
      const afterAnswer = await rounds(primary);
      expect((await owner.post(`${endpoint}/answer`, { headers, data: { answer: "Repeated answer" } })).status()).toBe(409);
      expect(await rounds(primary)).toEqual(afterAnswer);
    }
    const primaryRows = await rounds(primary), primarySession = await session(primary);
    expect(primaryRows).toHaveLength(3); expect(primarySession.round_count).toBe(3);
    primaryRows.forEach(({ row }, index) => expect(row).toMatchObject({
      round: index + 1, status: "answered", question: questions[index].question,
      assumption: questions[index].assumption, source: questions[index].source,
      answer: "We will run a short trial and use the observed result to decide the next change.", outcome: outcomes[index],
    }));
    expect((await owner.post(`${endpoint}/round`, { headers })).status()).toBe(409);
    expect(await rounds(primary)).toEqual(primaryRows);
    const concurrent = await start(), concurrentPath = `/api/challenge/${concurrent}`;
    const concurrentRounds = await Promise.all([0, 1].map(() => owner.post(`${concurrentPath}/round`, { headers })));
    expect(concurrentRounds.map((response) => response.status()).sort()).toEqual([200, 409]);
    expect((await session(concurrent)).round_count).toBe(1); expect(await rounds(concurrent)).toHaveLength(1);
    const concurrentAnswers = await Promise.all([0, 1].map(() => owner.post(`${concurrentPath}/answer`, { headers, data: { answer: "Test the meal-selection workflow with a teammate." } })));
    expect(concurrentAnswers.map((response) => response.status()).sort()).toEqual([200, 409]);
    // Invalid provenance must exhaust the shared client's one retry, then end this round.
    await fixture("challenge-round-1", { ...grounded, source: { ...grounded.source, sourceIds: ["f".repeat(40)] } });
    const recovery = await start(), recoveryPath = `/api/challenge/${recovery}`;
    const invalid = await owner.post(`${recoveryPath}/round`, { headers });
    expect(invalid.status()).toBe(502);
    expect((await session(recovery)).round_count).toBe(1);
    const failed = await rounds(recovery); expect(failed).toHaveLength(1);
    expect(failed[0].row.status).toBe("failed");
    const recovered = await owner.post(`${recoveryPath}/round`, { headers });
    expect(recovered.status()).toBe(200); expect((await recovered.json()).round).toBe(2);
    expect(await versions(version.ideaId)).toEqual(originalVersions);
    const evidence = JSON.stringify({ mode: "generation-fixture-real-corpus-and-database", retainedWorkspace: workspaceIds[0], versionId: version.versionId, questions, outcomes, session: primarySession, storedRounds: primaryRows, fourthRoundStatus: 409, concurrentRoundStatuses: concurrentRounds.map((r) => r.status()), concurrentAnswerStatuses: concurrentAnswers.map((r) => r.status()), invalidSourceStatus: invalid.status(), recoveredRound: 2, ideaVersionsUnchanged: true, retainedSessionIds: [primary, concurrent, recovery] }, null, 2);
    await writeFile(info.outputPath("stored-challenge.json"), evidence);
    await info.attach("stored-challenge", { body: evidence, contentType: "application/json" });
    retainedWorkspace = workspaceIds[0];
  } finally {
    const cleanup = await Promise.allSettled([...createdWorkspaces].filter((id) => id !== retainedWorkspace).map((id) => sql`delete from workspaces where id = ${id}::uuid`));
    const files = await Promise.allSettled([...createdFixtures].map((path) => unlink(path)));
    await Promise.allSettled(clients.map((client) => client.dispose()));
    if ([...cleanup, ...files].some((result) => result.status === "rejected")) throw new Error("Challenge cleanup failed for its explicit test resources");
  }
});
