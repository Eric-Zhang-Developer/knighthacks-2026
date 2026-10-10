import { expect, test } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

test.use({ trace: "off" }); // Session cookies never enter retained traces.
const fields = { title: "Team meal planner", description: "Help hackathon teams coordinate shared meals.",
  audience: "Hackathon teammates", problem: "Dietary constraints make group orders difficult",
  workflow: "Collect dietary constraints, compare meal options and choose a shared meal", constraints: "Text input works without a microphone" };
const c = (text: string, label = "inferred", sourceIds: string[] = []) => ({ text, label, sourceIds });

test("plans are scoped, append-only and grounded, with a freeze inside the deadline", async ({ playwright, baseURL }, info) => {
  test.setTimeout(240000);
  const live = process.env.LIVE_BUILD_PLAN === "1", stub = process.env.AI_STUB_DIR;
  const target = process.env.TEST_DATABASE_URL!;
  expect(Boolean(target) && process.env.DATABASE_URL === target, "Dedicated test database required before writes").toBe(true);
  if (live) expect(stub).toBeFalsy();
  else expect(Boolean(stub) && isAbsolute(stub!)).toBe(true);
  const db = neon(target), origin = new URL(baseURL!).origin, headers = { origin };
  const [owner, stranger, anonymous] = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
  const workspaces: string[] = [];
  let versionId = "";
  try {
    for (const context of [owner, stranger]) {
      const r = await context.post("/api/workspace", { headers }); expect(r.status()).toBe(201);
      workspaces.push((await r.json()).workspaceId);
    }
    const saved = await owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: fields });
    expect(saved.status()).toBe(201); const version = await saved.json(); versionId = version.versionId;
    const path = `/api/plan/${versionId}`, body = { hoursLeft: 10, teamSize: 2, skills: ["TypeScript"] };
    const post = () => owner.post(path, { headers, data: body, timeout: 120000 });
    expect((await owner.get(path)).status()).toBe(404);
    // Snapshot one real neighbor excerpt as evidence; never invent corpus records.
    await db`insert into evidence_cards(version_id,project_id,url,title,excerpt,overlaps,differences,uncertainty)
      select ${versionId}::uuid,id,url,title,left(coalesce(description,tagline,title),6000),'[]'::jsonb,'[]'::jsonb,
      '{"text":"Evidence has not been assessed in this fixture","label":"unverified","sourceIds":[]}'::jsonb
      from projects where id=${version.neighborIds[0]}`;
    const quote = (await db`select project_id,excerpt from evidence_cards where version_id=${versionId}::uuid`)[0];
    const quotedText = String(quote.excerpt).slice(0,120).trim();
    const draft = { tour: [c(quotedText, "supported", [quote.project_id])], cut: [c("Automatic meal ordering")],
      timeline: [{ hour: 0, goal: "Build the text flow", label: "inferred", sourceIds: [] },
        { hour: 9, goal: "Code freeze", label: "inferred", sourceIds: [] }],
      risks: [{ risk: "Dietary needs may differ", countermeasure: "Ask users to check their own constraints", label: "inferred", sourceIds: [] }] };
    if (!live) await writeFile(join(stub!, `plan-${versionId}.json`), JSON.stringify(draft));
    const response = await post(); expect(response.status(), await response.text()).toBe(201);
    const plan = await response.json();
    expect(plan.tour.length).toBeGreaterThan(0); expect(plan.tour.length).toBeLessThanOrEqual(6);
    expect(plan.cut.length).toBeLessThanOrEqual(8); expect(plan.risks.length).toBeGreaterThan(0);
    for (const item of [...plan.tour,...plan.cut,...plan.timeline,...plan.risks]) {
      expect(["supported","inferred","unverified"]).toContain(item.label); expect(Array.isArray(item.sourceIds)).toBe(true);
    }
    for (let i=1;i<plan.timeline.length;i++) expect(plan.timeline[i].hour).toBeGreaterThan(plan.timeline[i-1].hour);
    expect(plan.hoursLeft).toBe(10); expect(plan.teamSize).toBe(2); expect(plan.skills).toEqual(["TypeScript"]);
    expect(plan.timeline.at(-1).hour).toBeLessThanOrEqual(9);
    expect(plan.timeline.at(-1).goal).toBe("Code freeze");
    expect(await (await owner.get(path)).json()).toEqual(plan);
    await writeFile(info.outputPath(live ? "live-plan.json" : "plan.json"), JSON.stringify(plan,null,2));
    if (!live) {
      expect(plan.tour[0]).toEqual(draft.tour[0]);
      // Regeneration creates new rows, never modifies the first; concurrency also appends.
      const repeats = await Promise.all([post(),post()]);
      for (const r of repeats) expect(r.status()).toBe(201);
      const ids = await Promise.all(repeats.map(async (r) => (await r.json()).id));
      expect(new Set([plan.id,...ids]).size).toBe(3);
      const stored = await db`select id,data from build_plans where version_id=${versionId}::uuid order by created_at desc,id desc`;
      expect(stored).toHaveLength(3); expect((await (await owner.get(path)).json()).id).toBe(stored[0].id);
      expect(stored.find((r) => r.id===plan.id)!.data.tour).toEqual(plan.tour);
      await writeFile(join(stub!, `plan-${versionId}.json`), JSON.stringify({ ...draft, timeline: [draft.timeline[0],{...draft.timeline[1],hour:10}] }));
      expect((await post()).status()).toBe(502);
      await unlink(join(stub!, `plan-${versionId}.json`));
      expect((await post()).status()).toBe(502);
      expect((await db`select id from build_plans where version_id=${versionId}::uuid`)).toHaveLength(3);
    }
    expect((await stranger.post(path,{headers,data:body})).status()).toBe(404);
    expect((await stranger.get(path)).status()).toBe(404);
    expect((await anonymous.post(path,{headers,data:body})).status()).toBe(401);
    expect((await owner.post(path,{headers:{origin:"https://evil.example"},data:body})).status()).toBe(403);
    expect((await owner.post(path,{headers,data:{hoursLeft:1}})).status()).toBe(400);
    expect((await owner.get("/api/plan/not-a-uuid")).status()).toBe(404);
  } finally {
    if (stub && versionId) await unlink(join(stub,`plan-${versionId}.json`)).catch(() => {});
    for (const id of workspaces) if (id) await db`delete from workspaces where id=${id}::uuid`;
    await Promise.all([owner,stranger,anonymous].map((c) => c.dispose()));
  }
});
