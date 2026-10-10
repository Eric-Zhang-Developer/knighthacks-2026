import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// Real save, snapshot, share and rehearsal APIs on the Neon test branch; only generation is stubbed (AI_STUB_DIR, a
// fresh absolute directory): the fixture is written for the real version id just before the server asks. A 502 is
// served by a stubbed route. Traces would hold the session cookie.
test.use({ trace: "off" });
const workflow = "Collect each teammate's dietary constraints, then choose a shared meal";
const interpretation = { title: "Team meal planner", description: "Help hackathon teams plan shared meals.",
  audience: "Hackathon teammates", problem: "Coordinating meals while building together", workflow, constraints: null };
const items = ["dietary constraints form", "a shared meal list"];
const claim = (text: string, label: string) => ({ text, label, sourceIds: [] as string[] });
const q = (n: number, basis = claim(workflow, "supported")) => ({ question: `Question ${n}: what if no meal fits everyone?`, weakness: `Weak spot ${n}`, basis });
const fixture = { pitch: [
  { text: "See how the dietary constraints form collects everyone's limits.", status: "built" },
  { text: "Ordering from nearby restaurants already works.", status: "built" }, // unlisted: the API makes it planned
  { text: "Next we plan to split the bill.", status: "planned" },
], questions: [q(1), q(2, claim("Judges like live demos", "supported")), q(3)] };

test("list what works, draft: Built and Planned in words, three questions; 502 keeps the list; reload reads; share link never shows it", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const stub = process.env.AI_STUB_DIR;
  expect(Boolean(stub) && isAbsolute(stub!), "Start the server with a fresh absolute AI_STUB_DIR").toBe(true);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must both use the test branch").toBe(true);
  const sql = neon(process.env.TEST_DATABASE_URL!);
  await writeFile(join(stub!, "idea-interpret.json"), JSON.stringify(interpretation));
  let fail = true;
  await page.route("**/api/rehearsal/**", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    if (fail) { await new Promise((r) => setTimeout(r, 1000)); return route.fulfill({ status: 502, json: { error: "unavailable" } }); }
    const versionId = new URL(route.request().url()).pathname.split("/").pop()!;
    await writeFile(join(stub!, `rehearsal-${versionId}.json`), JSON.stringify(fixture));
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
  const versionId = await page.getByRole("article", { name: "Decision snapshot" }).getAttribute("data-version-id");

  const share = page.getByRole("region", { name: "Share" });
  const rehearse = share.getByRole("group", { name: "Rehearse" });
  const draft = rehearse.getByRole("button", { name: /Draft pitch|Drafting…/ });
  await expect(draft).toBeDisabled({ timeout: 30_000 }); // no items yet
  await expect(rehearse).toContainText("List at least one thing that works now.");
  await rehearse.getByRole("textbox", { name: "What works now, item 1" }).fill(items[0]);
  await rehearse.getByRole("button", { name: "Add an item" }).click();
  await rehearse.getByRole("textbox", { name: "What works now, item 2" }).fill(items[1]);

  // 3. The API fails: "Drafting…" while waiting, then the error line, and the list is kept.
  await draft.click();
  await expect(draft).toHaveText("Drafting…");
  await expect(draft).toBeDisabled();
  await expect(rehearse.getByRole("alert")).toContainText("Couldn't draft the pitch. Try again.");
  await expect(rehearse.getByRole("textbox", { name: "What works now, item 1" })).toHaveValue(items[0]);
  await expect(rehearse.getByRole("textbox", { name: "What works now, item 2" })).toHaveValue(items[1]);

  // 1. Draft for real: Built and Planned as words, and three questions with weakness and basis label.
  fail = false;
  await draft.click();
  const pitch = rehearse.getByRole("list", { name: "Pitch" }).getByRole("listitem");
  await expect(pitch).toHaveCount(3, { timeout: 30_000 });
  await expect(pitch.nth(0).locator("[data-status]")).toHaveText(/Built/);
  await expect(pitch.nth(1).locator("[data-status]")).toHaveText(/Planned/);
  await expect(pitch.nth(1)).toContainText("Ordering from nearby restaurants already works.");
  await expect(pitch.nth(2).locator("[data-status]")).toHaveText(/Planned/);
  const questions = rehearse.getByRole("list", { name: "Judge questions" }).getByRole("listitem");
  await expect(questions).toHaveCount(3);
  await expect(questions.nth(0)).toContainText("Probes: Weak spot 1");
  await expect(questions.nth(0).locator('[data-label="supported"]')).toHaveText(/supported/);
  await expect(questions.nth(1).locator('[data-label="inferred"]')).toHaveText(/inferred/);
  // Below the moment, above the share button.
  const [moment, rehearseBox, button] = await Promise.all([share.getByRole("group", { name: "Show me the moment" }).boundingBox(),
    rehearse.boundingBox(), share.getByRole("button", { name: "Create a read-only link" }).boundingBox()]);
  expect(moment!.y).toBeLessThan(rehearseBox!.y);
  expect(rehearseBox!.y).toBeLessThan(button!.y);
  await rehearse.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("rehearsal.png") });

  // 4. The read-only share page: no Rehearse section and no request to /api/rehearsal. Checked before the reload,
  // because the Decide snapshot that sharing needs isn't restored on reload.
  const shareRegion = page.getByRole("region", { name: "Share" });
  await shareRegion.getByRole("button", { name: "Create a read-only link" }).click();
  const url = (await shareRegion.locator("[data-share-url]").textContent())!;
  const visitor = await (await browser.newContext()).newPage();
  const seen: string[] = [];
  visitor.on("request", (r) => { if (r.url().includes("/api/rehearsal")) seen.push(r.url()); });
  await visitor.goto(url);
  await expect(visitor.getByRole("article", { name: "Shared decision" })).toContainText(workflow, { timeout: 30_000 });
  await visitor.waitForLoadState("networkidle");
  await expect(visitor.getByText("Rehearse")).toHaveCount(0);
  expect(seen).toEqual([]);

  // 2. Reload: the stored rehearsal for the active version shows, with no new POST.
  const posts: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/rehearsal/") && r.method() === "POST") posts.push(r.url()); });
  await page.reload();
  const again = page.getByRole("region", { name: "Share" }).getByRole("group", { name: "Rehearse" });
  await expect(again.getByRole("list", { name: "Pitch" }).getByRole("listitem")).toHaveCount(3, { timeout: 30_000 });
  await expect(again.getByRole("textbox", { name: "What works now, item 2" })).toHaveValue(items[1]);
  expect(posts).toEqual([]);
  expect((await sql`select count(*)::int as n from rehearsals where version_id = ${versionId}::uuid`)[0].n).toBe(1);
});
