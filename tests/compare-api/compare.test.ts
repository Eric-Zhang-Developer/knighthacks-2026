import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const { execute, generate, getEvidence, lookupSession } = vi.hoisted(() => ({
  execute: vi.fn(), generate: vi.fn(), getEvidence: vi.fn(), lookupSession: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute }) }));
vi.mock("@/lib/ai/generate", () => ({ generate }));
vi.mock("@/lib/evidence/service", () => ({ getEvidence }));
vi.mock("@/lib/workspace/service", () => ({ lookupSession }));
import { compare } from "@/lib/compare/service";
import { CRITERIA, requestSchema } from "@/lib/compare/contract";
import { POST } from "@/app/api/compare/route";
import { COOKIE } from "@/lib/workspace/tokens";
const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
const output = () => ({ criteria: CRITERIA.map((name) => ({ name, perVersion: ids.map((versionId) => ({
  versionId, reason: { text: "An inferred tradeoff", label: "inferred", sourceIds: [] as string[] }, uncertainty: "Needs a user trial" })) })) });
function request(body: unknown, cookie = true, origin = "https://uncharted.test") {
  return new NextRequest("https://uncharted.test/api/compare", { method: "POST", headers: {
    origin, "content-type": "application/json", ...(cookie ? { cookie: `${COOKIE}=${"a".repeat(43)}` } : {}),
  }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.resetAllMocks(); lookupSession.mockResolvedValue({ workspaceId: "owner" });
  execute.mockResolvedValue({ rows: ids.map((versionId) => ({ versionId, title: "Fictional test idea" })) });
  getEvidence.mockResolvedValue({ cards: [] }); generate.mockImplementation(async () => output());
});
test("endpoint rejects missing sessions, foreign origins, duplicate or malformed selections and oversized bodies", async () => {
  expect((await POST(request({ versionIds: ids }, false))).status).toBe(401);
  expect((await POST(request({ versionIds: ids }, true, "https://foreign.test"))).status).toBe(403);
  for (const versionIds of [[], [ids[0]], [ids[0], ids[0]], [...ids, ...ids], [ids[0], "bad"]])
    expect((await POST(request({ versionIds }))).status).toBe(400);
  expect((await POST(request({ versionIds: ids, workspaceId: "other" }))).status).toBe(400);
  expect((await POST(request({ extra: "x".repeat(66000) }))).status).toBe(413);
  expect(execute).not.toHaveBeenCalled(); expect(generate).not.toHaveBeenCalled();
});
test("foreign versions fail before evidence or generation and provider errors stay private", async () => {
  execute.mockResolvedValueOnce({ rows: [{ versionId: ids[0] }] });
  expect((await POST(request({ versionIds: ids }))).status).toBe(404);
  expect(getEvidence).not.toHaveBeenCalled(); expect(generate).not.toHaveBeenCalled();
  generate.mockRejectedValueOnce(new Error("private provider credential"));
  const response = await POST(request({ versionIds: ids }));
  expect(response.status).toBe(502); expect(await response.text()).not.toContain("credential");
});
test("all criteria are complete and canonicalized; unsupported no-card claims become inferred", async () => {
  const fixture = output(); fixture.criteria.reverse();
  for (const c of fixture.criteria) { c.perVersion.reverse(); c.perVersion[0].reason.label = "supported"; c.perVersion[0].reason.sourceIds = ["unknown"]; }
  generate.mockResolvedValueOnce(fixture);
  const result = await compare("owner", ids);
  expect(result.criteria.map((c) => c.name)).toEqual(CRITERIA);
  for (const c of result.criteria) { expect(c.perVersion.map((v) => v.versionId)).toEqual(ids);
    for (const v of c.perVersion) expect(v.reason).toMatchObject({ label: "inferred", sourceIds: [] }); }
});
test("citations are local to each version, quotes stay supported, and deductions stay inferred", async () => {
  getEvidence.mockImplementation(async (_w, id) => ({ cards: [{ projectId: id, excerpt: "A real excerpt" }] }));
  const fixture = output();
  for (const c of fixture.criteria) for (const v of c.perVersion) v.reason = { text: "A real excerpt", label: "supported", sourceIds: [v.versionId] };
  fixture.criteria[1].perVersion[0].reason.text = "An unsupported deduction";
  generate.mockResolvedValueOnce(fixture);
  const result = await compare("owner", ids);
  expect(result.criteria[0].perVersion[0].reason.label).toBe("supported");
  expect(result.criteria[1].perVersion[0].reason.label).toBe("inferred");
  fixture.criteria[0].perVersion[0].reason.sourceIds = [ids[1]];
  generate.mockResolvedValueOnce(fixture);
  await expect(compare("owner", ids)).rejects.toMatchObject({ status: 502 });
});
test("missing citations, incomplete matrices, duplicate criteria and numeric ratings are rejected", async () => {
  const broken = [output(), output(), output(), output(), output(), output()];
  broken[0].criteria[0].perVersion.pop();
  broken[1].criteria[0].perVersion[1].versionId = ids[0];
  broken[2].criteria[0].name = CRITERIA[1];
  broken[3].criteria[0].perVersion[0].reason.text = "Win probability 90%";
  broken[4].criteria[0].perVersion[0].uncertainty = "Rating ３";
  Object.assign(broken[5], { score: 5 });
  for (const fixture of broken) { generate.mockResolvedValueOnce(fixture);
    await expect(compare("owner", ids)).rejects.toMatchObject({ status: 502 }); }
  getEvidence.mockResolvedValue({ cards: [{ projectId: "source", excerpt: "Known text" }] });
  await expect(compare("owner", ids)).rejects.toMatchObject({ status: 502 });
});

test("UUID casing cannot duplicate a selection or hide authorized version text", () => {
  const id = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
  expect(requestSchema.safeParse({ versionIds: [id, id.toUpperCase()] }).success).toBe(false);
  expect(requestSchema.parse({ versionIds: [id.toUpperCase(), ids[0]] }).versionIds).toEqual([id, ids[0]]);
});
