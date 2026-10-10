import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Reads the committed corpus export, so the check holds for whatever corpus is shipped.
const stars = JSON.parse(readFileSync("public/corpus/stars.json", "utf8"));

test("the panel's count and coverage come from stars.json", async ({ page }) => {
  await page.goto("/");
  await page.getByText("What am I looking at?").click();
  await expect(page.getByTestId("explainer-count")).toHaveText(String(stars.count));
  const events = new Set(stars.stars.map((s: { event: string | null }) => s.event ?? "Event unknown"));
  await expect(page.getByRole("list", { name: "Source coverage" }).getByRole("listitem")).toHaveCount(events.size);
  await expect(page.getByTestId("explainer-text")).toContainText("does not mean an idea is original");
  const words = (await page.getByTestId("explainer-text").innerText()).split(/\s+/).filter(Boolean).length;
  expect(words).toBeLessThan(120);
  await page.locator("canvas").waitFor();
  await page.waitForTimeout(1000); // let WebGL paint so the evidence shows stars, not a blank canvas
  await page.screenshot({ path: test.info().outputPath("explainer.png") });
});
