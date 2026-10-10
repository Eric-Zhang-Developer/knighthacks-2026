import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import tracks from "@/lib/rubric/tracks.json";
import type { Overlay } from "@/lib/rubric/contract";

test.use({ trace: "off", video: "off" });
test("frozen rubric requirements and grounded intent survive proof edits and repeated generation", async ({ playwright, baseURL }, info) => {
  test.setTimeout(210000);
  expect(Boolean(process.env.TEST_DATABASE_URL)).toBe(true);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL).toBe(true);
  const fixtures = process.env.AI_STUB_DIR;
  expect(Boolean(fixtures) && isAbsolute(fixtures!)).toBe(true); expect(process.env.AI_STUB_ALLOW).toBe("1");
  if (!fixtures || !baseURL) throw new Error("Fresh fixture directory and verifier app required");
  await mkdir(fixtures, { recursive: true });
  const sql = neon(process.env.TEST_DATABASE_URL!);
  async function query<T>(operation: PromiseLike<T>) { try { return await operation; } catch { throw new Error("Rubric test database query failed"); } }
  const origin = new URL(baseURL).origin, headers = { origin };
  const clients = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
  const [owner, stranger, anonymous] = clients;
  const createdWorkspaces = new Set<string>();
  let retainedWorkspace: string | undefined, fixtureCreated = false;
  const fixtureFile = join(fixtures, "rubric-overlay.json");
  try {
    const workspace = await owner.post("/api/workspace", { headers }); expect(workspace.status()).toBe(201);
    const { workspaceId } = await workspace.json();
    expect(workspaceId).toMatch(/^[a-f0-9-]{36}$/i); createdWorkspaces.add(workspaceId);
    const strangerCreated = await stranger.post("/api/workspace", { headers }); expect(strangerCreated.status()).toBe(201);
    const strangerId = (await strangerCreated.json()).workspaceId as string;
    expect(strangerId).toMatch(/^[a-f0-9-]{36}$/i); createdWorkspaces.add(strangerId);
    const saved = await owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: {
      title: "Build a meal planner in 36 hours", description: "Help hackathon teammates agree on shared meals", audience: "Hackathon teams", problem: "Meal coordination", workflow: "Collect requirements and choose a meal", constraints: null,
    } });
    expect(saved.status()).toBe(201); const version = await saved.json();
    const fixture = { tracks: tracks.map((track, index) => ({ trackId: track.id,
      stated: index === 0 ? [{ text: "36 hours", label: "supported", sourceIds: ["invented-source"] }] : index === 1 ? [{ text: "A deployed sponsor integration exists", label: "supported", sourceIds: [version.versionId] }] : [],
      speculative: index === 2 ? [{ text: "This could fit the event", label: "supported", sourceIds: ["foreign-source"] }] : [],
    })) };
    await writeFile(fixtureFile, JSON.stringify(fixture), { flag: "wx" }); fixtureCreated = true;
    const path = `/api/rubric/${version.versionId}`;
    expect((await anonymous.post(path, { headers })).status()).toBe(401);
    expect((await stranger.post(path, { headers })).status()).toBe(404);
    expect((await owner.get(path)).status()).toBe(404);
    const results = await Promise.all([owner.post(path, { headers }), owner.post(path, { headers })]);
    expect(results.map((response) => response.status())).toEqual([200, 200]);
    const bodies: Overlay[] = await Promise.all(results.map((response) => response.json()));
    expect(bodies[0]).toEqual(bodies[1]); const overlay = bodies[0];
    expect(overlay.tracks.map((track) => [track.trackId, track.requirement])).toEqual(tracks.map((track) => [track.id, track.rewards]));
    expect(overlay.tracks[0].stated[0]).toEqual({ text: "36 hours", label: "supported", sourceIds: [version.versionId] });
    expect(overlay.tracks[1]).toMatchObject({ stated: [], speculative: [{ label: "unverified", sourceIds: [] }] });
    expect(overlay.tracks[2].speculative[0]).toMatchObject({ label: "unverified", sourceIds: [] });
    expect(overlay.tracks.every((track) => track.proof === null)).toBe(true);
    const before = await query(sql`select "data", "created_at" from "rubric_overlays" where "version_id" = ${version.versionId}::uuid`);
    expect(before).toHaveLength(1);
    const proof = "https://example.test/demo -- user supplied test proof, not a verified deployment";
    expect((await stranger.patch(`${path}/${tracks[0].id}`, { headers, data: { proof } })).status()).toBe(404);
    expect((await owner.patch(`${path}/${tracks[0].id}`, { headers: { origin: "https://foreign.test" }, data: { proof } })).status()).toBe(403);
    expect((await owner.patch(`${path}/${tracks[0].id}`, { headers, data: { proof } })).status()).toBe(200);
    await unlink(fixtureFile); fixtureCreated = false; // A configured missing fixture cannot fall through to a live provider.
    const repeat = await owner.post(path, { headers }); expect(repeat.status()).toBe(200);
    const get = await owner.get(path); expect(get.status()).toBe(200);
    const stored: Overlay = await get.json(); expect(await repeat.json()).toEqual(stored); expect(stored.tracks[0].proof).toBe(proof);
    expect(await query(sql`select "data", "created_at" from "rubric_overlays" where "version_id" = ${version.versionId}::uuid`)).toEqual(before);
    expect((await stranger.get(path)).status()).toBe(404);
    await writeFile(info.outputPath("rubric.json"), JSON.stringify({ workspaceId, versionId: version.versionId, statuses: results.map((response) => response.status()), overlay: stored, retained: true }, null, 2));
    retainedWorkspace = workspaceId;
  } finally {
    const cleanup = await Promise.allSettled([
      ...(fixtureCreated ? [unlink(fixtureFile)] : []),
      ...[...createdWorkspaces].filter((id) => id !== retainedWorkspace).map((id) => query(sql`delete from "workspaces" where "id" = ${id}::uuid`)),
      ...clients.map((client) => client.dispose()),
    ]);
    if (cleanup.some((result) => result.status === "rejected")) throw new Error("Rubric test cleanup failed; only this test's exact workspace IDs and owned fixture were targeted");
  }
});

