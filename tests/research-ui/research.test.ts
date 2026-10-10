import { expect, test } from "vitest";
import { kindOf, popularity, unavailableText, type Item } from "@/components/idea/research-groups";

const item = (source: Item["source"], kind: Item["kind"]) => ({ source, kind }) as Item;
test("a model or dataset never groups as a direct alternative", () => {
  expect(kindOf(item("hf-model", "direct-alternative"))).toBe("building-block");
  expect(kindOf(item("hf-dataset", "direct-alternative"))).toBe("building-block");
  expect(kindOf(item("hf-space", "direct-alternative"))).toBe("direct-alternative");
  expect(kindOf(item("github", "adjacent"))).toBe("adjacent");
});
test("popularity names its metric; an unanswered source says so", () => {
  expect(popularity({ metric: "stars", value: 1204 })).toBe("1,204 stars");
  expect(popularity(null)).toBeNull();
  expect(unavailableText({ source: "github", status: 403 })).toBe("GitHub didn't answer (403); try again later");
  expect(unavailableText({ source: "hf-space", status: 0 })).toBe("Hugging Face Space didn't answer (timed out); try again later");
});
