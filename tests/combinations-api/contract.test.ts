import { expect, test, vi } from "vitest";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
vi.mock("next/dist/compiled/server-only", () => ({}));
import { generatedSchema, normalize, type Source } from "@/lib/combinations/contract";
const a = "a".repeat(40), b = "b".repeat(40), c = "c".repeat(40);
const sources: Source[] = [a, b, c].map((id) => ({ projectId: id, title: id, url: `https://example.test/${id}`, excerpt: `A stored quote for ${id}` }));
const candidate = () => ({ user: "Hackathon teammates", benefit: { text: "Might reduce coordination work", label: "inferred", sourceIds: [a, b] }, workflow: ["Collect requirements", "Choose a shared meal"], sourceIds: [a, b], claims: [{ text: sources[0].excerpt, label: "supported", sourceIds: [a] }] });
test("SDK structured schemas preserve valid candidates while dropping malformed siblings independently", () => {
  expect(z.toJSONSchema(generatedSchema, { io: "input" })).toHaveProperty("properties.suggestions");
  expect(zodOutputFormat(generatedSchema)).toHaveProperty("type", "json_schema");
  const parsed = generatedSchema.parse({ suggestions: [candidate(), { sourceIds: [a, b] }, { ...candidate(), sourceIds: [a, b, c] }] });
  expect(parsed.suggestions[0]).not.toBeNull(); expect(parsed.suggestions.slice(1)).toEqual([null, null]);
  expect(normalize("version", parsed.suggestions, sources).suggestions).toHaveLength(1);
});
test("exact pair and required fields are never padded; outside, duplicate or third source drops candidate", () => {
  for (const invalid of [{ ...candidate(), sourceIds: [a, "outside"] }, { ...candidate(), sourceIds: [a, a] }, { ...candidate(), sourceIds: [a, b, c] }, { ...candidate(), user: " " }, { ...candidate(), benefit: null }, { ...candidate(), workflow: [] }]) {
    expect(normalize("version", [invalid], sources).suggestions).toEqual([]);
  }
});
test("server metadata and proposed workflow marker do not come from generated data", () => {
  const result = normalize("version", [candidate()], sources).suggestions[0];
  expect(result.sources).toEqual(sources.slice(0, 2).map(({ projectId, url, title }) => ({ projectId, url, title })));
  expect(result.workflowIsProposal).toBe(true); expect(result.claims[0].label).toBe("supported");
});
test("all claims including benefit are checked before filtering foreign IDs and require real quotations", () => {
  const value = candidate(); value.benefit = { text: "Not in any excerpt", label: "supported", sourceIds: [a] };
  value.claims = [{ text: sources[0].excerpt, label: "supported", sourceIds: [a, c] }, { text: sources[0].excerpt, label: "supported", sourceIds: [a, b] }];
  const result = normalize("version", [value], sources).suggestions[0];
  expect(result.benefit.label).toBe("unverified");
  expect(result.claims[0]).toMatchObject({ label: "unverified", sourceIds: [a] });
  expect(result.claims[1].label).toBe("unverified");
});
test("existing-combination and win assertions are dropped; all-invalid remains honestly empty", () => {
  for (const text of ["This combination already exists", "This combined workflow is deployed", "This will win", "High chance of winning"]) {
    const value = candidate(); value.benefit.text = text;
    expect(normalize("version", [value], sources).suggestions).toEqual([]);
  }
  expect(normalize("version", [null, {}, false], sources)).toEqual({ versionId: "version", suggestions: [] });
});
