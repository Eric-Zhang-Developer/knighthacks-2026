import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// The conversation drives the screen: each proposal fills the Idea step (the person's own edits are kept), and a
// project search opens its top match. Fixtures: UI behaviour only. The voice provider can't run in CI, so the search
// result is delivered the way Live.tsx hands it over (the mentor:evidence event); proposals use the real typed path.
const record = JSON.parse(readFileSync("corpus/fixtures/sample.jsonl", "utf8").split("\n")[0]) as { id: string; title: string; url: string };

for (const [device, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]] as const) {
  test(`the conversation fills the idea and pulls up a related project (${device})`, async ({ page }) => {
    test.setTimeout(90_000); // the headless galaxy is slow to draw 76k stars
    await page.setViewportSize(viewport);
    let sequence = 0;
    await page.route("**/api/workspace", (route) => route.fulfill({ json: { workspaceId: "fixture-workspace", memberId: "fixture-member" } }));
    await page.route("**/api/ideas", (route) => route.fulfill({ json: [] }));
    await page.route("**/api/ideas/interpret", (route) => route.fulfill({ json: {
      title: `Fixture direction ${++sequence}`, description: "Test proposal, not real generated content", audience: "Students", problem: "Planning study time", workflow: null, constraints: null,
    } }));
    await page.route("**/api/ideas/questions", (route) => route.fulfill({ json: { done: true, questions: [] } }));
    await page.route(`**/api/projects/${record.id}`, (route) => route.fulfill({ json: { id: record.id, url: record.url, title: record.title, tagline: null, description: "Fixture description", technologies: [], events: [], date: null, dateKind: "unknown" } }));
    await page.goto("/#talk");
    await page.getByRole("button", { name: "Prefer to type?" }).click();
    const say = async (text: string) => {
      await page.getByRole("textbox", { name: "Message Golden Egg" }).fill(text);
      await page.getByRole("button", { name: "Send message", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "Message Golden Egg" })).toBeEmpty();
    };

    await say("Consider a study planner");
    const idea = page.getByRole("region", { name: "Your idea" });
    await expect(idea.getByRole("heading", { name: "Your idea, from the conversation" })).toBeVisible();
    await expect(idea.getByLabel("Title")).toHaveValue("Fixture direction 1");
    await idea.getByLabel("Audience").fill("Night-shift nurses");
    await idea.scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath(`${device}-1-filled.png`) });

    await say("Make it more focused");
    await expect(idea.getByLabel("Title")).toHaveValue("Fixture direction 2");
    await expect(idea.getByLabel("Audience")).toHaveValue("Night-shift nurses");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.evaluate((p) => window.dispatchEvent(new CustomEvent("mentor:evidence", { detail: [p] })),
      { projectId: record.id, title: record.title, url: record.url, excerpt: "Fixture excerpt" });
    const drawer = page.locator('[data-panel="drawer"]');
    await expect(drawer.getByText(record.title).first()).toBeVisible({ timeout: 20_000 }); // the headless GPU stalls on the galaxy
    await expect(drawer.getByText(record.title).first()).toBeInViewport();
    await expect(page.getByRole("region", { name: "Conversation sources" })).toBeVisible();
    await page.waitForTimeout(800); // the smooth scroll
    await page.screenshot({ path: test.info().outputPath(`${device}-2-project.png`) });
  });
}
