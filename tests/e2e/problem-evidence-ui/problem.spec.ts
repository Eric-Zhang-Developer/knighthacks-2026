import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// Real save on the Neon test branch; interpretation reads AI_STUB_DIR (fresh, absolute). Test 1 serves fixture evidence
// from a stubbed route (the grounded search is verified in problem-evidence-api); test 2 hits the real API's 422.
test.use({ trace: "off" });
const interpretation = (problem: string | null) => ({ title: "Team meal planner", description: "Help hackathon teams plan shared meals.",
  audience: "Hackathon teammates", problem, workflow: "Collect dietary constraints, then choose a meal", constraints: null });
const idea = (page: Page) => page.getByRole("region", { name: "Your idea" });
const block = (page: Page) => idea(page).getByRole("group", { name: "Is this problem real?" });
const claim = (text: string, label: string) => ({ text, label, sourceIds: [] as string[] });
const item = (n: number, about: "problem" | "solution", extra: Record<string, unknown> = {}) => ({ id: `e${n}`, about,
  claim: claim(`Finding ${n}: teams skip meals during long events`, "supported"),
  source: { title: `Source ${n}`, domain: `site${n}.example.org`, url: `https://site${n}.example.org/a` },
  publishedAt: "2025-03-20T09:32:13+00:00", eventDate: null, relevance: claim(`Shows the problem in case ${n}`, "inferred"), ...extra });
const evidence = { versionId: "x", problem: "p", searchedAt: "2026-10-10T18:00:00Z", model: "gemini", items: [
  item(1, "problem", { eventDate: "2024" }), item(2, "problem", { publishedAt: null, source: { title: "Untitled source", domain: "vertexaisearch.cloud.google.com", url: null } }),
  item(3, "problem"), item(4, "problem"), item(5, "solution"), item(6, "solution") ] };

async function save(page: Page, problem: string | null) {
  await writeFile(join(process.env.AI_STUB_DIR!, "idea-interpret.json"), JSON.stringify(interpretation(problem)));
  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("button", { name: "Interpret" }).click();
  await idea(page).getByRole("button", { name: "Save" }).click();
  await expect(idea(page).getByRole("heading")).toHaveText("Team meal planner", { timeout: 60_000 });
}

test("problem items first with source, date or 'date not given', and labels; solutions under their own heading", async ({ page }) => {
  test.setTimeout(120_000);
  expect(Boolean(process.env.AI_STUB_DIR) && isAbsolute(process.env.AI_STUB_DIR!), "Start the server with a fresh absolute AI_STUB_DIR").toBe(true);
  let stored = false;
  await page.route("**/api/problem-evidence/**", (r) =>
    r.request().method() === "POST" ? ((stored = true), r.fulfill({ json: evidence })) : r.fulfill(stored ? { json: evidence } : { status: 404, json: { error: "Not found" } }));
  await save(page, "Teams lose building time deciding on food");
  await expect(idea(page)).toContainText("Problem: Teams lose building time deciding on food");

  await block(page).getByRole("button", { name: "Is this problem real?" }).click();
  await expect(block(page)).toContainText("Searched the web on");
  const problems = block(page).getByRole("list", { name: "About the problem" }).getByRole("listitem");
  await expect(problems).toHaveCount(3); // collapsed to three
  await expect(problems.nth(0)).toContainText("site1.example.org");
  await expect(problems.nth(0)).toContainText("published Mar 20, 2025");
  await expect(problems.nth(0).locator("time")).toHaveAttribute("datetime", "2025-03-20T09:32:13+00:00");
  await expect(problems.nth(0)).toContainText("event date 2024");
  await expect(problems.nth(0).getByRole("link", { name: "Source 1" })).toHaveAttribute("href", "https://site1.example.org/a");
  await expect(problems.nth(0).locator('[data-label="supported"]')).toHaveText(/supported/);
  await expect(problems.nth(0).locator('[data-label="inferred"]')).toHaveText(/inferred/);
  await expect(problems.nth(1)).toContainText("date not given");
  await expect(problems.nth(1).getByRole("link")).toHaveCount(0); // no url: title only, not linked
  await block(page).getByRole("button", { name: "Show 1 more" }).click();
  await expect(problems).toHaveCount(4);
  const solutions = block(page).getByRole("list", { name: "About solutions, not the problem" }).getByRole("listitem");
  await expect(solutions).toHaveCount(2);
  await expect(block(page).locator('[data-about="solution"]')).toHaveCount(2);
  await block(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("problem-evidence.png") });
});

test("an idea with no problem: the 422 message, and no request loop", async ({ page }) => {
  test.setTimeout(120_000);
  const posts: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/problem-evidence/") && r.method() === "POST") posts.push(r.url()); });
  await save(page, null);
  await block(page).getByRole("button", { name: "Is this problem real?" }).click();
  await expect(block(page).getByRole("status")).toContainText("no problem stated yet", { timeout: 30_000 });
  await page.waitForTimeout(3000);
  expect(posts).toHaveLength(1);
});
