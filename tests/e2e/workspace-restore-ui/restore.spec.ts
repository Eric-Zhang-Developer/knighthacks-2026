import { copyFile, readdir } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Real backend on the Neon test branch; the model is stubbed through AI_STUB_DIR (a fresh absolute temp folder this
// test copies its fixtures into) with AI_STUB_ALLOW=1.
test.use({ trace: "off" }); // traces would hold the session cookie
const fixtures = join(__dirname, "fixtures");
const decide = (page: Page) => page.getByRole("region", { name: "Decision" });
const branches = (page: Page) => page.getByRole("region", { name: "Branches" });
const history = (page: Page) => decide(page).getByRole("region", { name: "Past snapshots" });
const rows = (page: Page) => history(page).getByRole("listitem").filter({ has: page.locator("[data-snapshot-row]") });

async function copyFixtures() {
  const stub = process.env.AI_STUB_DIR;
  expect(stub && isAbsolute(stub), "Set AI_STUB_DIR to a fresh absolute temp folder").toBeTruthy();
  for (const f of await readdir(fixtures)) await copyFile(join(fixtures, f), join(stub!, f));
}

async function saveIdea(page: Page) {
  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("button", { name: "Interpret" }).click();
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();
  await expect(decide(page)).not.toHaveAttribute("data-active-version", "", { timeout: 60_000 });
  return (await decide(page).getAttribute("data-active-version"))!;
}

async function choose(page: Page, label: RegExp) {
  await decide(page).getByRole("button", { name: label }).click();
  await expect(decide(page).getByRole("article", { name: "Decision snapshot" })).toHaveAttribute("data-version-id", (await decide(page).getAttribute("data-active-version"))!, { timeout: 60_000 });
  return (await decide(page).getByRole("article", { name: "Decision snapshot" }).getAttribute("data-snapshot-id"))!;
}

test("a reload keeps the chosen version, lists past snapshots and their links, and revokes a link", async ({ page }) => {
  test.setTimeout(240_000);
  await copyFixtures();
  const v1 = await saveIdea(page);

  // Branch once, so v1 is no longer the newest version, then choose v1 again.
  await branches(page).getByRole("button", { name: "Suggest directions" }).click();
  await branches(page).getByRole("list", { name: "Directions" }).getByRole("listitem").first().getByRole("button", { name: "Branch this way" }).click();
  // The branch trail names versions "<title> v1", "<title> v2".
  const version = (n: number) => branches(page).getByRole("button", { name: new RegExp(` v${n}$`) });
  await expect(version(2)).toBeVisible({ timeout: 60_000 });
  await version(2).click();
  const v2 = (await decide(page).getAttribute("data-active-version"))!;
  expect(v2).not.toBe(v1);

  // Validation 2: two snapshots, one per version.
  const older = await choose(page, /Choose this version/);
  await version(1).click();
  await expect(decide(page)).toHaveAttribute("data-active-version", v1);
  const newer = await choose(page, /Choose the current version instead/);

  // Validation 3 (first half): a share link for the newer snapshot.
  const share = page.getByRole("region", { name: "Share" });
  await share.getByRole("button", { name: "Create a read-only link" }).click();
  const url = (await share.locator("[data-share-url]").getAttribute("href"))!;

  // Validation 1: v1 (not the newest) is active, and still is after reload.
  await page.reload();
  await expect(decide(page)).toHaveAttribute("data-active-version", v1, { timeout: 60_000 });

  // Validation 2: both snapshots listed, newest first; choosing the older shows it.
  await expect(rows(page)).toHaveCount(2, { timeout: 30_000 });
  await expect(rows(page).nth(0).locator("[data-snapshot-row]")).toHaveAttribute("data-snapshot-row", newer);
  await expect(rows(page).nth(1).locator("[data-snapshot-row]")).toHaveAttribute("data-snapshot-row", older);
  await rows(page).nth(1).getByRole("button").first().click();
  await expect(decide(page).getByRole("article", { name: "Decision snapshot" })).toHaveAttribute("data-snapshot-id", older);
  await expect(decide(page).getByRole("article", { name: "Decision snapshot" })).toHaveAttribute("data-version-id", v2);

  // Validation 3: the link is listed under the newer snapshot; Revoke needs no dialog and the link's page says revoked.
  page.on("dialog", () => {
    throw new Error("Revoke must not open a browser dialog");
  });
  const link = rows(page).nth(0).getByRole("list", { name: "Share links" }).getByRole("listitem");
  await expect(link).toHaveAttribute("data-share-state", "live");
  await link.getByRole("button", { name: "Revoke" }).click();
  await expect(link.getByRole("button", { name: "Revoked" })).toBeDisabled();
  await expect(link).toContainText(/revoked \w+/);
  await page.screenshot({ path: test.info().outputPath("restore.png"), fullPage: true });
  const shared = await page.context().newPage();
  await shared.goto(url);
  await expect(shared.getByText("This link was revoked by its owner.")).toBeVisible({ timeout: 30_000 });
});

test("with storage blocked the page still works and starts on the newest idea", async ({ browser }) => {
  test.setTimeout(180_000);
  await copyFixtures();
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage is blocked", "SecurityError"); } });
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const v1 = await saveIdea(page);
  await page.reload();
  await expect(decide(page)).toHaveAttribute("data-active-version", v1, { timeout: 60_000 });
  expect(errors).toEqual([]);
  await context.close();
});
