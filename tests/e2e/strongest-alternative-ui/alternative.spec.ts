import { neon } from "@neondatabase/serverless";
import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// Real save, embeddings, alternative API and Neon test branch; only generation is stubbed. The server reads fixtures
// from AI_STUB_DIR (a fresh absolute directory); the comparison fixture is written for the real top neighbor just
// before the server asks for it. Traces would hold the session cookie.
test.use({ trace: "off" });
const workflow = "Collect each teammate's dietary constraints, then choose a shared meal, then place one order";
const steps = ["Collect each teammate's dietary constraints", "choose a shared meal", "place one order"];
const interpretation = (title: string, withWorkflow: boolean) => ({
  title, description: "Help hackathon teams plan shared meals around their dietary constraints.", audience: "Hackathon teammates",
  problem: "Coordinating meals while building together", workflow: withWorkflow ? workflow : null, constraints: null,
});
const panel = (page: Page) => page.getByRole("region", { name: "Strongest alternative" });

async function saveIdea(page: Page, stub: string, title: string, withWorkflow: boolean) {
  await writeFile(join(stub, "idea-interpret.json"), JSON.stringify(interpretation(title, withWorkflow)));
  await page.getByRole("textbox", { name: "Describe your idea" }).fill(`${title}: plan shared meals for a hackathon team.`);
  await page.getByRole("button", { name: "Interpret" }).click();
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("region", { name: "Your idea" }).getByRole("heading")).toHaveText(title, { timeout: 60_000 });
}

test("the strongest alternative shows its source and step-tied labelled points, or asks for a workflow", async ({ page }) => {
  test.setTimeout(180_000);
  const stub = process.env.AI_STUB_DIR;
  expect(Boolean(stub) && isAbsolute(stub!), "Start the server with a fresh absolute AI_STUB_DIR").toBe(true);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must both use the test branch").toBe(true);
  const sql = neon(process.env.TEST_DATABASE_URL!);
  let top: { id: string; title: string; url: string; excerpt: string } | undefined;
  await page.route("**/api/alternative/**", async (route) => {
    const versionId = new URL(route.request().url()).pathname.split("/").pop()!;
    const [row] = await sql`select p.id, p.title, p.url, coalesce(nullif(trim(p.description), ''), nullif(trim(p.tagline), ''), p.title) as excerpt
      from idea_versions v join projects p on p.id = v.neighbor_ids[1] where v.id = ${versionId}::uuid`;
    top = row as typeof top;
    const claim = (text: string, label: string) => ({ text, label, sourceIds: [row.id] });
    await writeFile(join(stub!, `alternative-${row.id}.json`), JSON.stringify({ points: [
      { step: steps[0], claim: claim(String(row.excerpt).trim().slice(0, 40).trim(), "supported") },
      { step: steps[1], claim: claim("It has no way for a team to agree on one choice.", "inferred") },
      { step: steps[2], claim: claim("Whether it can place an order is unknown.", "unverified") },
    ] }));
    await route.continue();
  });

  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await saveIdea(page, stub!, "Team meal planner", true);

  // 1. The top neighbor with its source link; the first point is shown, each point names a step and a worded label.
  await expect.poll(() => top, { message: "the panel asked for the comparison", timeout: 60_000 }).toBeTruthy();
  await expect(panel(page).getByRole("link", { name: /Source/ })).toHaveAttribute("href", top!.url, { timeout: 60_000 });
  await expect(panel(page)).toContainText(top!.title);
  await expect(panel(page).getByText(`Step: ${steps[0]}`)).toBeVisible();
  await expect(panel(page).locator('[data-label="supported"]')).toHaveText(/supported/);
  await expect(panel(page).getByText(`Step: ${steps[1]}`)).toBeHidden(); // collapsed to the first point
  await panel(page).getByText("2 more points").click();
  for (const step of steps) await expect(panel(page).getByText(`Step: ${step}`)).toBeVisible();
  await expect(panel(page).locator('[data-label="inferred"]')).toHaveText(/inferred/);
  await expect(panel(page).locator('[data-label="unverified"]')).toHaveText(/unverified/);
  await panel(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("alternative.png") });

  // 2. An idea with no workflow: a prompt to add one, not an empty panel.
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "New idea" }).click();
  await saveIdea(page, stub!, "Meal idea without steps", false);
  await expect(panel(page)).toContainText("Your idea has no workflow yet", { timeout: 60_000 });
  await expect(panel(page).getByText(/^Step:/)).toHaveCount(0);
  await panel(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("missing-workflow.png") });
});
