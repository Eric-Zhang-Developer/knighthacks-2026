import { expect, test, vi } from "vitest";
vi.mock("next/dist/compiled/server-only", () => ({}));
import { searchCalls } from "@/lib/research/search";

test("HF receives bounded ID keywords while GitHub retains full queries", () => {
  const queries = ["hackathon idea feedback", "feedback for hackathon", "speech-to-text"];
  const calls = searchCalls(queries);
  expect(calls.filter(c => c.source === "github").map(c => c.q)).toEqual(queries);
  for (const source of ["hf-model", "hf-space", "hf-dataset"]) {
    expect(calls.filter(c => c.source === source).map(c => c.q)).toEqual(["hackathon", "feedback", "speech-to-text"]);
  }
});

test("case, whitespace and repeated terms do not multiply Hub requests", () => {
  const calls = searchCalls(["  MEAL meal planner ", "team meal"]);
  expect(calls).toHaveLength(11);
  expect(calls.filter(c => c.source === "hf-model").map(c => c.q)).toEqual(["planner", "meal", "team"]);
  expect(searchCalls(["for the and"]).every(c => c.source === "github")).toBe(true);
});

test("keyword selection preserves Unicode and is bounded for all three queries", () => {
  const calls = searchCalls(["résumé feedback scoring ranking", "music generation composition harmony", "speech translation transcription recognition"]);
  expect(calls).toHaveLength(21);
  expect(calls.some(c => c.q === "résumé")).toBe(false); // longer content terms win deterministically
  expect(searchCalls(["résumé ai"]).filter(c => c.source === "hf-model").map(c => c.q)).toEqual(["résumé", "ai"]);
});
