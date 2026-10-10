import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// Real save, snapshot, share and moment APIs on the Neon test branch; only generation is stubbed. The server reads
// fixtures from AI_STUB_DIR (a fresh absolute directory); the moment fixture is written for the real version id just
// before the server asks. Traces would hold the session cookie.
test.use({ trace: "off" });
const workflow = "Collect each teammate's dietary constraints, then choose a shared meal";
const interpretation = { title: "Team meal planner", description: "Help hackathon teams plan shared meals.",
  audience: "Hackathon teammates", problem: "Coordinating meals while building together", workflow, constraints: null };
const claim = (text: string, label: string) => ({ text, label, sourceIds: [] as string[] });
const steps = [
  { judgeDoes: "Enters two teammates' dietary limits", appears: "Both limits listed side by side", demonstrates: claim(workflow, "supported") },
  { judgeDoes: "Asks for a shared meal", appears: "Three meals both can eat", demonstrates: claim("Teams agree faster on food", "inferred") },
  { judgeDoes: "Picks one meal", appears: "The team's choice, ready to order", demonstrates: claim("Nobody is left without a safe option", "inferred") },
];

test("choose a version, see three numbered steps; the share link never shows or fetches the moment", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const stub = process.env.AI_STUB_DIR;
  expect(Boolean(stub) && isAbsolute(stub!), "Start the server with a fresh absolute AI_STUB_DIR").toBe(true);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must both use the test branch").toBe(true);
  const sql = neon(process.env.TEST_DATABASE_URL!);
  await writeFile(join(stub!, "idea-interpret.json"), JSON.stringify(interpretation));
  await page.route("**/api/moment/**", async (route) => {
    const versionId = new URL(route.request().url()).pathname.split("/").pop()!;
    if (route.request().method() === "POST") await writeFile(join(stub!, `moment-${versionId}.json`), JSON.stringify({ steps, basis: [claim(workflow, "supported")] }));
    await route.continue();
  });

  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("button", { name: "Interpret" }).click();
  const saved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/ideas" && r.request().method() === "POST", { timeout: 60_000 });
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();
  // Choosing a version generates its neighbours' evidence first (#181): one fixture per neighbour, nothing claimed.
  for (const id of ((await (await saved).json()) as { neighborIds: string[] }).neighborIds)
    await writeFile(join(stub!, `evidence-${id}.json`), JSON.stringify({ overlaps: [], differences: [], uncertainty: claim("Not stated on the page", "unverified") }));
  await page.getByRole("region", { name: "Decision" }).getByRole("button", { name: "Choose this version" }).click({ timeout: 60_000 });
  await expect(page.getByRole("article", { name: "Decision snapshot" })).toBeVisible({ timeout: 30_000 });

  // 1. Three numbered steps, each with all three parts, and every claim labelled in words.
  const share = page.getByRole("region", { name: "Share" });
  const moment = share.getByRole("group", { name: "Show me the moment" });
  await moment.getByRole("button", { name: "Show me the moment" }).click();
  const items = moment.locator("ol > li");
  await expect(items).toHaveCount(3, { timeout: 30_000 });
  for (const [i, s] of steps.entries()) {
    const item = items.nth(i);
    await expect(item).toContainText(`Judge does ${s.judgeDoes}`);
    await expect(item).toContainText(`What appears ${s.appears}`);
    await expect(item).toContainText(s.demonstrates.text);
    await expect(item.locator(`[data-label="${s.demonstrates.label}"]`)).toHaveText(new RegExp(s.demonstrates.label));
  }
  await expect(moment.locator("ul [data-label='supported']")).toHaveText(/supported/); // the basis
  // Sits above the share button, which is unchanged.
  const boxes = await Promise.all([moment.boundingBox(), share.getByRole("button", { name: "Create a read-only link" }).boundingBox()]);
  expect(boxes[0]!.y).toBeLessThan(boxes[1]!.y);
  const versionId = await page.getByRole("article", { name: "Decision snapshot" }).getAttribute("data-version-id");
  await moment.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("moment.png") });

  // 2. The read-only share page: no moment section and no request to /api/moment.
  const shareRegion = page.getByRole("region", { name: "Share" });
  await shareRegion.getByRole("button", { name: "Create a read-only link" }).click();
  const url = (await shareRegion.locator("[data-share-url]").textContent())!;
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const visitor = await phone.newPage();
  const momentRequests: string[] = [];
  visitor.on("request", (r) => { if (r.url().includes("/api/moment")) momentRequests.push(r.url()); });
  await visitor.goto(url);
  await expect(visitor.getByRole("article", { name: "Shared decision" })).toContainText(workflow, { timeout: 30_000 });
  await visitor.waitForLoadState("networkidle");
  await expect(visitor.getByText("Show me the moment")).toHaveCount(0);
  expect(momentRequests).toEqual([]);
  await phone.close();

  // A reload reads the stored moment without the button (and without a model call: one row, no new fixture needed).
  await page.reload();
  await expect(page.getByRole("region", { name: "Share" }).getByRole("group", { name: "Show me the moment" }).locator("ol > li")).toHaveCount(3, { timeout: 30_000 });
  expect((await sql`select count(*)::int as n from moments where version_id = ${versionId}::uuid`)[0].n).toBe(1);
});
