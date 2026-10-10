import { expect, test } from "@playwright/test";
import { access, readFile, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// The idea comes from the committed interpret fixture; the plan from a stub keyed to the saved version. Neither is a
// corpus record, so nothing here is invented evidence: the one "supported" line quotes the idea's own description.
const committed = join(process.cwd(), "tests/e2e/idea-create-ui/fixtures/idea-interpret.json");
const item = (text: string, label = "inferred", sourceIds: string[] = []) => ({ text, label, sourceIds });

test("a saved idea plans into four labelled sections; a failed regenerate offers retry and keeps the earlier plan", async ({ page }, info) => {
  test.setTimeout(180_000);
  const stub = process.env.AI_STUB_DIR;
  expect(Boolean(stub) && isAbsolute(stub!), "Start the server with an absolute AI_STUB_DIR").toBe(true);
  const fixture = join(stub!, "idea-interpret.json");
  const wrote: string[] = [];
  if (!(await access(fixture).then(() => true, () => false))) {
    await writeFile(fixture, await readFile(committed));
    wrote.push(fixture);
  }
  const idea = JSON.parse(await readFile(fixture, "utf8")) as { description: string };
  try {
    await page.goto("/");
    const card = page.getByRole("region", { name: "Your idea" });
    await card.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
    await card.getByRole("button", { name: "Interpret" }).click();
    const saved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/ideas" && r.request().method() === "POST");
    await card.getByRole("button", { name: "Save" }).click({ timeout: 60_000 });
    const { versionId } = (await (await saved).json()) as { versionId: string };
    const plan = join(stub!, `plan-${versionId}.json`);
    wrote.push(plan);
    await writeFile(plan, JSON.stringify({
      tour: [item(idea.description, "supported", [versionId]), item("Pick a meal and show the team's choice")],
      cut: [item("Restaurant ordering and payments")],
      timeline: [{ hour: 1, goal: "Constraints form saves", label: "inferred", sourceIds: [] }, { hour: 7, goal: "Code freeze", label: "inferred", sourceIds: [] }],
      risks: [{ risk: "No real menu data", countermeasure: "Hand-enter three local menus", label: "unverified", sourceIds: [] }],
    }));

    // 1. Prefilled inputs, then the four sections, each line with its worded badge.
    const panel = page.getByRole("region", { name: "Plan" });
    await expect(panel.getByLabel("Hours left")).toHaveValue("10");
    await expect(panel.getByLabel("Team size")).toHaveValue("2");
    await panel.getByRole("button", { name: "Plan this idea" }).click();
    const tour = panel.getByRole("list", { name: "Demo tour" });
    await expect(tour.getByRole("listitem").first()).toContainText(`supported ${idea.description}`, { timeout: 60_000 });
    await expect(panel.getByRole("list", { name: "Cut list" })).toContainText("inferred Restaurant ordering and payments");
    await expect(panel.getByRole("list", { name: "Timeline" }).getByRole("listitem").last()).toContainText("+7 h");
    await expect(panel.getByRole("list", { name: "Timeline" })).toContainText("Code freeze");
    await expect(panel.getByRole("list", { name: "Risks" })).toContainText("unverified No real menu data");
    await expect(panel).toContainText("Countermeasure: Hand-enter three local menus");
    await expect(panel).not.toContainText(/odds|chance of winning/i);
    await panel.screenshot({ path: info.outputPath("plan.png") });

    // 2. A failure from the stubbed route shows failed plus retry, and the plan made before stays readable.
    await page.route("**/api/plan/**", (r) =>
      r.request().method() === "POST" ? r.fulfill({ status: 503, json: { error: "Build planning is temporarily unavailable." } }) : r.fallback());
    await panel.getByLabel("Hours left").fill("9");
    await panel.getByRole("button", { name: "Regenerate" }).click();
    await expect(panel.getByRole("alert")).toContainText("Couldn't plan this idea: Build planning is temporarily unavailable.");
    await expect(panel.getByText("Earlier plan: 10 hours, 2 people")).toBeVisible();
    await panel.screenshot({ path: info.outputPath("failed.png") });
    await page.unroute("**/api/plan/**");
    await panel.getByRole("alert").getByRole("button", { name: "Retry" }).click();
    await expect(panel).toContainText("For 9 hours and 2 people.", { timeout: 60_000 });
    await expect(panel.getByText("Earlier plan: 10 hours, 2 people")).toBeVisible();
    await expect(panel.getByRole("alert")).toHaveCount(0);
  } finally {
    await Promise.all(wrote.map((f) => unlink(f).catch(() => {})));
  }
});
