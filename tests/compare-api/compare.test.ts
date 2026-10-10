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
import { CRITERIA, requestSchema, resultSchema } from "@/lib/compare/contract";
import { POST } from "@/app/api/compare/route";
import { COOKIE } from "@/lib/workspace/tokens";
const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
const output = (versionCount = ids.length) => ({ m: CRITERIA.map(() => Array.from({ length: versionCount }, () => ({
  r: "An inferred tradeoff", l: "inferred", s: [] as string[], u: "Needs a user trial" }))) });
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
test("unsupported no-card claims become inferred in the unchanged public response", async () => {
  const fixture = output();
  for (const row of fixture.m) row[0].l = "supported";
  generate.mockResolvedValueOnce(fixture);
  const result = await compare("owner", ids);
  expect(resultSchema.safeParse(result).success).toBe(true);
  expect(result.criteria.map((c) => c.name)).toEqual(CRITERIA);
  for (const c of result.criteria) { expect(c.perVersion.map((v) => v.versionId)).toEqual(ids);
    for (const v of c.perVersion) expect(v.reason).toMatchObject({ label: "inferred", sourceIds: [] }); }
});
test.each([2, 3])("the matrix maps all criteria and %i selected versions in request order with one generation", async (count) => {
  const selected = [...ids, "33333333-3333-4333-8333-333333333333"].slice(0, count).reverse();
  execute.mockResolvedValueOnce({ rows: selected.toReversed().map((versionId) => ({ versionId, title: "Fictional test idea" })) });
  const fixture = output(count);
  for (const [rowIndex, row] of fixture.m.entries()) for (const [column, cell] of row.entries())
    cell.r = `${CRITERIA[rowIndex]} for version ${["alpha", "beta", "gamma"][column]}`;
  generate.mockResolvedValueOnce(fixture);
  const result = await compare("owner", selected);
  expect(resultSchema.safeParse(result).success).toBe(true);
  expect(result.criteria.map((c) => c.name)).toEqual(CRITERIA);
  for (const [index, criterion] of result.criteria.entries()) {
    expect(criterion.perVersion.map((v) => v.versionId)).toEqual(selected);
    expect(criterion.perVersion.map((v) => v.reason.text)).toEqual(fixture.m[index].map((cell) => cell.r));
  }
  expect(generate).toHaveBeenCalledTimes(1);
});
test("citations are local to each version, quotes stay supported, and deductions stay inferred", async () => {
  getEvidence.mockImplementation(async (_w, id) => ({ cards: [{ projectId: id, excerpt: "A real excerpt" }] }));
  const fixture = output();
  for (const row of fixture.m) for (const [column, cell] of row.entries())
    Object.assign(cell, { r: "A real excerpt", l: "supported", s: [["a0", "b0"][column]] });
  fixture.m[1][0].r = "An unsupported deduction";
  generate.mockResolvedValueOnce(fixture);
  const result = await compare("owner", ids);
  expect(result.criteria[0].perVersion[0].reason.label).toBe("supported");
  expect(result.criteria[1].perVersion[0].reason.label).toBe("inferred");
  for (const criterion of result.criteria) expect(criterion.perVersion.map((v) => v.reason.sourceIds)).toEqual(ids.map((id) => [id]));
});
test("the prompt preserves full stored excerpts and idea fields without prior generated claims or URLs", async () => {
  const versions = ids.map((versionId) => ({ versionId, title: "Fictional idea", description: "A proposed workflow",
    audience: "Hackathon teams", problem: "Meal coordination", workflow: "Choose a shared meal", constraints: "Limited time" }));
  execute.mockResolvedValueOnce({ rows: versions });
  const excerpt = "A complete stored source excerpt. ".repeat(180);
  const card = { projectId: "stored-source", title: "Stored project title", excerpt, url: "https://example.test/stored-source",
    overlaps: [{ text: "Prior generated overlap", label: "inferred", sourceIds: ["stored-source"] }],
    differences: [{ text: "Prior generated difference", label: "inferred", sourceIds: ["stored-source"] }],
    uncertainty: { text: "Prior generated uncertainty", label: "unverified", sourceIds: [] } };
  getEvidence.mockImplementation(async (_w, id) => ({ cards: id === ids[0] ? [card] : [] }));
  const fixture = output();
  for (const row of fixture.m) row[0].s = ["a0"];
  generate.mockResolvedValueOnce(fixture);
  await compare("owner", ids);
  const prompt = generate.mock.calls[0][0].prompt.text as string;
  const data = JSON.parse(prompt.slice(prompt.lastIndexOf("\n") + 1));
  expect(data.versions).toEqual([
    { ...versions[0], cards: [{ projectId: card.projectId, title: card.title, excerpt, citationAlias: "a0" }] },
    { ...versions[1], cards: [] },
  ]);
  for (const omitted of [card.url, card.overlaps[0].text, card.differences[0].text, card.uncertainty.text])
    expect(prompt).not.toContain(omitted);
});
test.each(["unknown", "b0", ids[0]])("an unknown, cross-version, or raw citation %s is rejected even for a shared project", async (alias) => {
  getEvidence.mockResolvedValue({ cards: [{ projectId: ids[0], excerpt: "A real excerpt" }] });
  const fixture = output();
  for (const row of fixture.m) { row[0].s = ["a0"]; row[1].s = ["b0"]; }
  fixture.m[0][0].s = [alias];
  generate.mockResolvedValueOnce(fixture);
  await expect(compare("owner", ids)).rejects.toMatchObject({ status: 502 });
});
test("a cardless version cannot borrow another version's citation alias", async () => {
  getEvidence.mockImplementation(async (_w, id) => ({ cards: id === ids[0] ? [{ projectId: "source", excerpt: "Known text" }] : [] }));
  const fixture = output();
  for (const row of fixture.m) row[0].s = ["a0"];
  fixture.m[0][1].s = ["a0"];
  generate.mockResolvedValueOnce(fixture);
  await expect(compare("owner", ids)).rejects.toMatchObject({ status: 502 });
});
test("missing or extra rows and cells, injected identities, and numeric ratings are rejected", async () => {
  const broken = Array.from({ length: 9 }, () => output());
  broken[0].m.pop();
  broken[1].m.push(broken[1].m[0]);
  broken[2].m[0].pop();
  broken[3].m[0].push(broken[3].m[0][0]);
  Object.assign(broken[4].m[0][0], { versionId: ids[0] });
  Object.assign(broken[5].m[0][0], { name: CRITERIA[1] });
  broken[6].m[0][0].r = "Win probability 90%";
  broken[7].m[0][0].u = "Rating ３";
  Object.assign(broken[8], { score: 5 });
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
