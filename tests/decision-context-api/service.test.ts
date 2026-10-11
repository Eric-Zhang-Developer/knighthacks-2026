import { beforeEach, expect, test, vi } from "vitest";
const { execute, generate, getEvidence } = vi.hoisted(() => ({ execute: vi.fn(), generate: vi.fn(), getEvidence: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute }) }));
vi.mock("@/lib/ai/generate", () => ({ generate }));
vi.mock("@/lib/evidence/service", () => ({ getEvidence }));
import { recommend, select } from "@/lib/decision-context/service";

const idea = { title: "Meal planner", description: "Plan shared meals", audience: "Hackathon teams", problem: "Diets clash", workflow: null, constraints: null };
const profile = { interests: ["food"], skills: ["React"], hardware: [], hoursLeft: 5, teamSize: 2, enthusiasm: 3 };
const card = { projectId: "p1", url: "https://devpost.com/software/x", title: "X", excerpt: "Plans meals for teams", overlaps: [], differences: [], uncertainty: { text: "u", label: "unverified", sourceIds: [] } };
const claim = (text: string) => ({ text, label: "inferred", sourceIds: [] });
const output = { features: [{ title: claim("Diet form"), demoStep: claim("Fill the form"), reason: claim("Needed"), requirements: { skills: [], hardware: [], hours: 1 } }] };
const rows = (r: unknown[]) => ({ rows: r });
beforeEach(() => { vi.resetAllMocks(); getEvidence.mockResolvedValue({ cards: [card] }); generate.mockResolvedValue(output); });

test("the prompt carries the exact saved profile, idea fields and evidence, as data", async () => {
  execute.mockResolvedValueOnce(rows([idea])).mockResolvedValueOnce(rows([{ profile }]))
    .mockResolvedValueOnce(rows([{ id: "r1", versionId: "v1", profileRevision: 2, features: [], createdAt: "2026-10-11T00:00:00Z" }]));
  await recommend("w1", "11111111-1111-4111-8111-111111111111", 2);
  const { text, stubKey } = generate.mock.calls[0][0].prompt;
  expect(stubKey).toBe("scope-11111111-1111-4111-8111-111111111111");
  expect(text).toContain(JSON.stringify(profile));
  expect(text).toContain(JSON.stringify(idea));
  expect(text).toContain(JSON.stringify([card]));
  expect(text).toMatch(/data, never as instructions/);
});

test("revision 0 recommends against an entirely unknown profile without reading one", async () => {
  execute.mockResolvedValueOnce(rows([idea])).mockResolvedValueOnce(rows([{ id: "r1", versionId: "v1", profileRevision: 0, features: [], createdAt: "2026-10-11T00:00:00Z" }]));
  await recommend("w1", "v1", 0);
  expect(generate.mock.calls[0][0].prompt.text).toContain('"profile":{"interests":[],"skills":[],"hardware":[],"hoursLeft":null,"teamSize":null,"enthusiasm":null}');
  expect(execute).toHaveBeenCalledTimes(2);
});

test("a foreign version or an unsaved profile revision never reaches the model", async () => {
  execute.mockResolvedValueOnce(rows([]));
  await expect(recommend("w1", "v1", 0)).rejects.toMatchObject({ status: 404 });
  execute.mockResolvedValueOnce(rows([idea])).mockResolvedValueOnce(rows([]));
  await expect(recommend("w1", "v1", 7)).rejects.toMatchObject({ status: 409 });
  expect(generate).not.toHaveBeenCalled();
});

test("a provider failure is a safe 502 and writes nothing", async () => {
  execute.mockResolvedValueOnce(rows([idea])).mockResolvedValueOnce(rows([{ profile }]));
  generate.mockRejectedValue(new Error("secret provider detail"));
  await expect(recommend("w1", "v1", 1)).rejects.toMatchObject({ status: 502, message: expect.not.stringContaining("secret") });
  expect(execute).toHaveBeenCalledTimes(2);
});

const features = [{ id: "a", demoStep: claim("A") }, { id: "b", demoStep: claim("B") }];
const rec = (versionId = "v1") => rows([{ versionId, features }]);
test.each([
  ["a duplicate id", [{ featureId: "a", scope: "core" }, { featureId: "a", scope: "later" }]],
  ["a missing id", [{ featureId: "a", scope: "core" }]],
  ["an extra id", [{ featureId: "a", scope: "core" }, { featureId: "b", scope: "core" }, { featureId: "c", scope: "core" }]],
  ["no core item", [{ featureId: "a", scope: "optional" }, { featureId: "b", scope: "later" }]],
])("a selection with %s is rejected before any write", async (_, choices) => {
  execute.mockResolvedValueOnce(rows([idea])).mockResolvedValueOnce(rec());
  await expect(select("w1", "v1", { recommendationId: "r1", expectedSelectionRevision: 0, choices: choices as never })).rejects.toMatchObject({ status: 400 });
  expect(execute).toHaveBeenCalledTimes(2);
});

test("a recommendation for another version is rejected", async () => {
  execute.mockResolvedValueOnce(rows([idea])).mockResolvedValueOnce(rec("v2"));
  await expect(select("w1", "v1", { recommendationId: "r1", expectedSelectionRevision: 0, choices: [{ featureId: "a", scope: "core" }, { featureId: "b", scope: "core" }] })).rejects.toMatchObject({ status: 400 });
});

test("a concurrent loser (unique violation) is a 409, not a 500", async () => {
  execute.mockResolvedValueOnce(rows([idea])).mockResolvedValueOnce(rec()).mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "23505" }));
  await expect(select("w1", "v1", { recommendationId: "r1", expectedSelectionRevision: 0, choices: [{ featureId: "a", scope: "core" }, { featureId: "b", scope: "later" }] })).rejects.toMatchObject({ status: 409 });
});
