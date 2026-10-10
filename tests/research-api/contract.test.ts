import { expect, test } from "vitest";
import { classify, dedupe, fromGitHub, fromHuggingFace } from "@/lib/research/contract";

const gh = { items: [{ full_name: "a/meal", html_url: "https://github.com/a/meal", description: null, stargazers_count: 6, updated_at: "2022-01-31T17:28:04Z" }, { html_url: "x" }] };
const hf = [{ id: "u/meal-model", likes: 0, createdAt: "2023-06-01T18:32:53.000Z" }];

test("fields are copied as returned; missing stays null; only the Hugging Face url is built", () => {
  expect(fromGitHub(gh)).toEqual([{ id: "github:a/meal", source: "github", name: "a/meal", url: "https://github.com/a/meal",
    description: null, popularity: { metric: "stars", value: 6 }, updatedAt: "2022-01-31T17:28:04Z" }]);
  expect(fromHuggingFace("hf-model", hf)[0]).toMatchObject({ url: "https://huggingface.co/u/meal-model", description: null, updatedAt: null, popularity: { metric: "likes", value: 0 } });
  expect(fromHuggingFace("hf-space", hf)[0].url).toBe("https://huggingface.co/spaces/u/meal-model");
  expect(fromHuggingFace("hf-dataset", hf)[0].url).toBe("https://huggingface.co/datasets/u/meal-model");
  expect(fromGitHub({ message: "rate limited" })).toEqual([]);
});
test("dedupe by url, at most 12", () => {
  const one = fromGitHub(gh)[0];
  expect(dedupe([one, { ...one, id: "dup" }])).toHaveLength(1);
  expect(dedupe(Array.from({ length: 20 }, (_, i) => ({ ...one, url: `u${i}` })))).toHaveLength(12);
});
test("unknown ids dropped, models never direct alternatives, reasons cite only their item, ordered by kind", () => {
  const found = [...fromHuggingFace("hf-model", hf), ...fromGitHub(gh)];
  const reason = (sourceIds: string[]) => ({ text: "Because", label: "supported" as const, sourceIds });
  const items = classify(found, { items: [
    { id: "hf-model:u/meal-model", kind: "direct-alternative", reason: reason(["elsewhere"]) },
    { id: "github:a/meal", kind: "direct-alternative", reason: reason([]) },
    { id: "github:invented", kind: "adjacent", reason: reason([]) },
  ] });
  expect(items.map((i) => [i.id, i.kind])).toEqual([["github:a/meal", "direct-alternative"], ["hf-model:u/meal-model", "building-block"]]);
  expect(items.map((i) => i.reason)).toEqual([{ text: "Because", label: "inferred", sourceIds: ["github:a/meal"] }, { text: "Because", label: "inferred", sourceIds: ["hf-model:u/meal-model"] }]);
});
