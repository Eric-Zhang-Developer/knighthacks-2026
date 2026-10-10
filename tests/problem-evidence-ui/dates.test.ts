import { expect, test } from "vitest";
import { day, moment } from "@/components/idea/research-groups";

test("dates read as a UTC day; text that isn't a date is shown as given", () => {
  expect(day("2025-03-20T23:32:13-05:00")).toBe("Mar 21, 2025");
  expect(day("sometime in spring")).toBe("sometime in spring");
  expect(moment("2026-10-10T18:30:00Z")).toBe("Oct 10, 2026, 6:30 PM UTC");
});
