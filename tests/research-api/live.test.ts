import { randomUUID } from "node:crypto";
import { expect, test, vi } from "vitest";
vi.mock("next/dist/compiled/server-only", () => ({}));
import { createWorkspace } from "@/lib/workspace/service";
import { createIdea } from "@/lib/ideas/service";
import { createResearch, getResearch } from "@/lib/research/service";
import { searchCalls } from "@/lib/research/search";

// Explicit live validation only: real generation, GitHub/HF search and saved test-branch rows.
test.skipIf(process.env.RESEARCH_LIVE !== "1")("saved AI-shaped idea returns real Hugging Face research", async () => {
  expect(process.env.TEST_DATABASE_URL).toBeTruthy();
  expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL);
  vi.stubEnv("AI_STUB_DIR", "");
  vi.stubEnv("RESEARCH_SEARCH_BASE", "");
  vi.stubEnv("AI_PROVIDER", "gemini");
  try {
    const { identity } = await createWorkspace();
    const { version } = await createIdea(identity.workspaceId, randomUUID(), {
      title: "Speech practice coach", description: "Transcribe practice speeches and give feedback on speaking clarity.",
      audience: "Students practicing presentations", problem: "Practice recordings are hard to review efficiently",
      workflow: "Record a practice speech, transcribe it, then review feedback", constraints: null,
    });
    const result = await createResearch(identity.workspaceId, version.versionId);
    const counts = Object.fromEntries(["github", "hf-model", "hf-space", "hf-dataset"].map(source => [source, result.items.filter(item => item.source === source).length]));
    process.stdout.write(JSON.stringify({ versionId: version.versionId, queries: result.queries, calls: searchCalls(result.queries), counts, unavailable: result.unavailable }) + "\n");
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.some(item => item.source.startsWith("hf-"))).toBe(true);
    expect(result.items.every(item => ["github.com", "huggingface.co"].includes(new URL(item.url).hostname))).toBe(true);
    expect(await getResearch(identity.workspaceId, version.versionId)).toEqual(result);
  } finally {
    vi.unstubAllEnvs();
  }
}, 180_000);
