import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// Real save on the Neon test branch; interpretation reads AI_STUB_DIR (fresh, absolute). Research is fixture data on a
// stubbed route: the real searches and classification are verified in research-api.
test.use({ trace: "off" });
const idea = (page: Page) => page.getByRole("region", { name: "Your idea" });
const block = (page: Page) => idea(page).getByRole("group", { name: "What already exists?" });
const group = (page: Page, starts: string) => block(page).getByRole("list", { name: new RegExp(`^${starts}`) }).getByRole("listitem");
const item = (n: number, source: string, kind: string, popularity: unknown = { metric: "likes", value: 1204 }) => ({
  id: `${source}:o/item-${n}`, source, name: `o/item-${n}`, url: `https://huggingface.co/o/item-${n}`, description: `Description ${n}`,
  popularity, updatedAt: null, kind, reason: { text: `Reason ${n}`, label: "inferred", sourceIds: [`${source}:o/item-${n}`] } });
const research = { versionId: "x", queries: ["meal planner"], searchedAt: "2026-10-10T18:30:00Z", unavailable: [{ source: "github", status: 403 }],
  items: [item(1, "hf-space", "direct-alternative"), item(2, "hf-space", "adjacent"), item(3, "hf-dataset", "research", null),
    item(4, "hf-model", "building-block", { metric: "downloads", value: 52000 }),
    item(5, "hf-model", "direct-alternative"), item(6, "hf-dataset", "building-block")] };

test("four groups with link, source, popularity metric and labelled reason; GitHub named as not answering; models are building blocks", async ({ page }) => {
  test.setTimeout(120_000);
  expect(Boolean(process.env.AI_STUB_DIR) && isAbsolute(process.env.AI_STUB_DIR!), "Start the server with a fresh absolute AI_STUB_DIR").toBe(true);
  await writeFile(join(process.env.AI_STUB_DIR!, "idea-interpret.json"), JSON.stringify({ title: "Team meal planner",
    description: "Help hackathon teams plan shared meals.", audience: null, problem: null, workflow: null, constraints: null }));
  let stored = false;
  await page.route("**/api/research/**", (r) =>
    r.request().method() === "POST" ? ((stored = true), r.fulfill({ json: research })) : r.fulfill(stored ? { json: research } : { status: 404, json: { error: "Not found" } }));
  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("button", { name: "Interpret" }).click();
  await idea(page).getByRole("button", { name: "Save" }).click();
  await expect(idea(page).getByRole("heading")).toHaveText("Team meal planner", { timeout: 60_000 });

  await block(page).getByRole("button", { name: "What already exists?" }).click();
  await expect(block(page)).toContainText("Searched on");
  await expect(block(page)).toContainText("GitHub didn't answer (403); try again later");
  await expect(block(page)).not.toContainText("nothing found");

  const direct = group(page, "Direct alternatives");
  await expect(direct).toHaveCount(1);
  await expect(direct.first().getByRole("link", { name: "o/item-1" })).toHaveAttribute("href", "https://huggingface.co/o/item-1");
  await expect(direct.first().getByRole("link")).toHaveAttribute("target", "_blank");
  await expect(direct.first().getByRole("link")).toHaveAttribute("rel", "noopener noreferrer");
  await expect(direct.first()).toContainText("Hugging Face Space · 1,204 likes");
  await expect(direct.first().locator('[data-label="inferred"]')).toHaveText(/inferred/);
  await expect(direct.first()).toContainText("Reason 1");
  await expect(group(page, "Adjacent work")).toHaveCount(1);
  await expect(group(page, "Research")).toContainText(["Hugging Face dataset"]);
  await expect(group(page, "Research").first()).not.toContainText("likes"); // no popularity: none invented

  // Building blocks: collapsed to two, and the model the response called a direct alternative lands here.
  const blocks = group(page, "Building blocks");
  await expect(blocks).toHaveCount(2);
  await block(page).getByRole("button", { name: "Show 1 more" }).click();
  await expect(blocks).toHaveCount(3);
  await expect(blocks.filter({ hasText: "o/item-5" })).toHaveCount(1);
  await expect(blocks.filter({ hasText: "o/item-4" })).toContainText("52,000 downloads");
  await expect(direct.filter({ hasText: "o/item-5" })).toHaveCount(0);
  await block(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("research.png") });
});
