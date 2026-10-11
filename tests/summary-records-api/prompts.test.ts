import { beforeEach, expect, test, vi } from "vitest";
const { execute, generate } = vi.hoisted(() => ({ execute: vi.fn(), generate: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute }) }));
vi.mock("@/lib/ai/generate", () => ({ generate }));
import { createEvidence } from "@/lib/evidence/service";
import { createAlternative } from "@/lib/alternative/service";
import { createCombinations } from "@/lib/combinations/service";
import { round } from "@/lib/challenge/service";
import { GALLERY_CARD, GALLERY_RULE } from "@/lib/evidence/contract";

const rows = (values: unknown[]) => ({ rows: values });
const a = "a".repeat(40), b = "b".repeat(40);
const full = { description: "A full write-up of how it works.", tagline: "Short pitch" };
const card = { description: "", tagline: "Short pitch only" };
const prompt = () => generate.mock.calls[0][0].prompt.text as string;
const hasNotice = (text: string) => text.includes(GALLERY_CARD) && text.includes(GALLERY_RULE.trim()) && text.includes('"galleryCardOnly":true');
const hasNone = (text: string) => !text.includes("galleryCard") && !text.includes(GALLERY_RULE.trim());
beforeEach(() => vi.resetAllMocks());

async function evidencePrompt(texts: object) {
  const version = { neighborIds: [a], corpusVersion: "corpus", title: "Idea", description: null, audience: null, problem: null, workflow: null, constraints: null };
  generate.mockResolvedValue({ overlaps: [], differences: [], uncertainty: { text: "Unknown", label: "unverified", sourceIds: [] } });
  execute.mockResolvedValueOnce(rows([version])).mockResolvedValueOnce(rows([]))
    .mockResolvedValueOnce(rows([{ id: a, url: "https://example.test/p", title: "Project A", corpusVersion: "corpus", ...texts }]))
    .mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([{ projectId: a }]));
  await createEvidence("workspace", "version", false);
  return prompt();
}
async function alternativePrompt(texts: object) {
  const version = { workflow: "Collect then choose", problem: "p", neighborIds: [a, b], corpusVersion: "corpus" };
  generate.mockResolvedValue({ points: [] });
  execute.mockResolvedValueOnce(rows([version])).mockResolvedValueOnce(rows([]))
    .mockResolvedValueOnce(rows([{ title: "Project A", url: "https://example.test/p", ...texts }]))
    .mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([{ data: {} }]));
  await createAlternative("workspace", "version").catch(() => {});
  return prompt();
}
async function combinationsPrompt(texts: object) {
  const version = { title: "Idea", workflow: "w", neighborIds: [a, b], corpusVersion: "corpus" };
  generate.mockResolvedValue({ suggestions: [] });
  const records = [{ id: a, title: "Project A", url: "https://example.test/a", ...texts }, { id: b, title: "Project B", url: "https://example.test/b", ...full }];
  execute.mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([version])).mockResolvedValueOnce(rows(records))
    .mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([{ data: {} }]));
  await createCombinations("workspace", "version").catch(() => {});
  return prompt();
}
async function challengePrompt(texts: object) {
  const session = { id: "session", versionId: "version", perspective: "judge", round: 0, state: "idle", title: "Idea", neighborIds: [a], corpusVersion: "corpus" };
  generate.mockResolvedValue({ question: "Q?", assumption: "A", source: null, test: "Ask five users" });
  execute.mockResolvedValueOnce(rows([session])).mockResolvedValueOnce(rows([{ round: 1 }]))
    .mockResolvedValueOnce(rows([{ id: a, title: "Project A", ...texts }])).mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([{ round: 1 }]));
  await round("workspace", "session").catch(() => {});
  return prompt();
}

test.each([
  ["evidence", evidencePrompt],
  ["strongest alternative", alternativePrompt],
  ["combinations", combinationsPrompt],
  ["challenge", challengePrompt],
])("%s: a gallery-card-only source is flagged and the rule added; a full project's prompt has neither", async (_, build) => {
  expect(hasNotice(await build(card))).toBe(true);
  vi.resetAllMocks();
  expect(hasNone(await build(full))).toBe(true);
});

test("whitespace-only descriptions count as gallery cards too", async () => {
  expect(hasNotice(await evidencePrompt({ description: "  \n ", tagline: "Pitch" }))).toBe(true);
});
