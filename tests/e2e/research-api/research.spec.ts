import { neon } from "@neondatabase/serverless";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { isAbsolute, join } from "node:path";

// Real sessions, saves (embeddings) and Neon test branch. Generation reads fixtures from AI_STUB_DIR (fresh, absolute);
// GitHub and Hugging Face answer from responses recorded from the real APIs (recorded/), served here on
// RESEARCH_SEARCH_BASE. Every search call is counted, so "no outside call" is checked, not assumed. Rows are kept.
test.use({ trace: "off" });
const PORT = 3197;
const recorded = (f: string) => JSON.parse(readFileSync(join(__dirname, "recorded", f), "utf8"));
const github = recorded("github.json"), hf = { models: recorded("hf-models.json"), spaces: recorded("hf-spaces.json"), datasets: recorded("hf-datasets.json") };
const fields = { title: "Team meal planner", description: "Help hackathon teams plan shared meals.", audience: "Hackathon teammates",
  problem: "Coordinating meals while building together", workflow: "Collect dietary constraints, then choose a meal", constraints: null };
const HF_PATH = { models: "", spaces: "spaces/", datasets: "datasets/" } as const;
const SOURCE = { models: "hf-model", spaces: "hf-space", datasets: "hf-dataset" } as const;

test("recorded results kept exactly, models never direct alternatives, unknown ids dropped, stored once; GitHub 403 listed", async ({ playwright, baseURL }, info) => {
  test.setTimeout(180_000);
  const stub = process.env.AI_STUB_DIR;
  expect(Boolean(stub) && isAbsolute(stub!), "Start the server with a fresh absolute AI_STUB_DIR").toBe(true);
  expect(process.env.RESEARCH_SEARCH_BASE, "Start the server with RESEARCH_SEARCH_BASE=http://127.0.0.1:3197").toBe(`http://127.0.0.1:${PORT}`);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must both use the test branch").toBe(true);
  let calls = 0, githubStatus = 200;
  const hfQueries: string[] = [];
  const server = createServer((req, res) => {
    calls++;
    const url = new URL(req.url!, "http://x"), path = url.pathname;
    if (path.startsWith("/hf/api/")) hfQueries.push(url.searchParams.get("search")!);
    const body = path === "/github/search/repositories" ? (githubStatus === 200 ? github : { message: "API rate limit exceeded" })
      : path.startsWith("/hf/api/") ? hf[path.slice("/hf/api/".length) as keyof typeof hf] : undefined;
    res.writeHead(path.startsWith("/github") ? githubStatus : body ? 200 : 404, { "content-type": "application/json" });
    res.end(JSON.stringify(body ?? {}));
  });
  await new Promise<void>((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  const sql = neon(process.env.TEST_DATABASE_URL!);
  const origin = new URL(baseURL!).origin, headers = { origin };
  const [owner, stranger, anonymous] = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
  try {
    for (const c of [owner, stranger]) expect((await c.post("/api/workspace", { headers })).status()).toBe(201);
    const save = async (c: APIRequestContext) =>
      (await (await c.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: fields })).json()).versionId as string;
    const fixture = (key: string, body: unknown) => writeFile(join(stub!, `${key}.json`), JSON.stringify(body));

    // What the recorded responses yield for one query, in call order, deduplicated by url and capped at 12.
    const all = [
      ...github.items.map((r: { full_name: string; html_url: string }) => ({ id: `github:${r.full_name}`, url: r.html_url, r, source: "github" })),
      ...(["models", "spaces", "datasets"] as const).flatMap((t) => hf[t].map((r: { id: string }) =>
        ({ id: `${SOURCE[t]}:${r.id}`, url: `https://huggingface.co/${HF_PATH[t]}${r.id}`, r, source: SOURCE[t] }))),
    ].slice(0, 12);
    const reason = { text: "Shares the idea's task.", label: "supported", sourceIds: ["somewhere-else"] };
    const firstModel = all.find((a) => a.source === "hf-model")!;
    const classification = { items: [
      ...all.map((a, i) => ({ id: a.id, kind: a === firstModel || i === 0 ? "direct-alternative" : "adjacent", reason })),
      { id: "github:invented/not-returned", kind: "direct-alternative", reason },
    ] };

    // 1. Items keep the recorded names, urls and popularity exactly.
    const v1 = await save(owner);
    await fixture(`research-queries-${v1}`, { queries: ["meal planner", "team meal"] });
    await fixture(`research-classify-${v1}`, classification);
    const first = await owner.post(`/api/research/${v1}`, { headers });
    expect(first.status()).toBe(200);
    const result = await first.json();
    expect(Object.keys(result).sort()).toEqual(["items", "queries", "searchedAt", "unavailable", "versionId"]);
    expect(result.queries).toEqual(["meal planner", "team meal"]);
    expect(result.unavailable).toEqual([]);
    expect(calls).toBe(11); // 2 GitHub queries + 3 distinct HF terms x 3 sources
    expect(hfQueries).toHaveLength(9);
    expect([...new Set(hfQueries)].sort()).toEqual(["meal", "planner", "team"]);
    expect(result.items).toHaveLength(12);
    for (const item of result.items) {
      const a = all.find((x) => x.id === item.id)!;
      expect(item.url).toBe(a.url);
      if (a.source === "github") {
        expect(item).toMatchObject({ name: a.r.full_name, description: a.r.description, updatedAt: a.r.updated_at, popularity: { metric: "stars", value: a.r.stargazers_count } });
      } else {
        expect(item).toMatchObject({ name: a.r.id, description: null, popularity: { metric: "likes", value: a.r.likes } });
      }
      expect(item.reason).toEqual({ text: reason.text, label: "inferred", sourceIds: [item.id] });
    }
    expect(result.items.find((i: { id: string }) => i.id === firstModel.id).kind, "a model is never a direct alternative").toBe("building-block");
    expect(result.items.find((i: { id: string }) => i.id === all[0].id).kind).toBe("direct-alternative");
    expect(result.items[0].kind).toBe("direct-alternative"); // direct alternatives first
    expect(result.items.some((i: { id: string }) => i.id === "github:invented/not-returned")).toBe(false);

    // POST again -> the same stored row, no outside call.
    const again = await owner.post(`/api/research/${v1}`, { headers });
    expect(await again.json()).toEqual(result);
    expect(await (await owner.get(`/api/research/${v1}`)).json()).toEqual(result);
    expect(calls).toBe(11);
    expect((await sql`select count(*)::int as n from research where version_id = ${v1}::uuid`)[0].n).toBe(1);

    // 2. GitHub answers 403: listed in unavailable; Hugging Face items still return.
    githubStatus = 403;
    const v2 = await save(owner);
    await fixture(`research-queries-${v2}`, { queries: ["meal planner"] });
    await fixture(`research-classify-${v2}`, { items: all.filter((a) => a.source !== "github").map((a) => ({ id: a.id, kind: "adjacent", reason })) });
    const limited = await (await owner.post(`/api/research/${v2}`, { headers })).json();
    expect(limited.unavailable).toEqual([{ source: "github", status: 403 }]);
    expect(limited.items.length).toBeGreaterThan(0);
    expect(limited.items.every((i: { source: string }) => i.source !== "github")).toBe(true);

    // Workspace, session and origin rules.
    expect((await stranger.post(`/api/research/${v1}`, { headers })).status()).toBe(404);
    expect((await stranger.get(`/api/research/${v1}`)).status()).toBe(404);
    expect((await anonymous.get(`/api/research/${v1}`)).status()).toBe(401);
    expect((await owner.post(`/api/research/${v1}`, { headers: { origin: "https://evil.test" } })).status()).toBe(403);
    await writeFile(info.outputPath("research.json"), JSON.stringify({ result, limited }, null, 2));
  } finally {
    await Promise.all([owner, stranger, anonymous].map((c) => c.dispose()));
    await new Promise((resolve) => server.close(resolve));
  }
});
