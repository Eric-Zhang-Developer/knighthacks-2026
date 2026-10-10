import { expect, test } from "vitest";
import { day, kindOf, moment, popularity, unavailableText, type Item } from "@/components/idea/research-groups";

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
test("dates read as a UTC day; text that isn't a date is shown as given", () => {
  expect(day("2025-03-20T23:32:13-05:00")).toBe("Mar 21, 2025");
  expect(day("sometime in spring")).toBe("sometime in spring");
  expect(moment("2026-10-10T18:30:00Z")).toBe("Oct 10, 2026, 6:30 PM UTC");
});
