import { copyFile, readdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import interpretation from "./fixtures/idea-interpret.json";

// Gemini is stubbed on the server through AI_STUB_DIR, a fresh absolute folder this test copies its fixtures into;
// embeddings and Neon are real.
test.use({ trace: "off" }); // traces would hold the session cookie
const view = (page: Page) => page.getByRole("article", { name: "Decision snapshot" });

test("choose a version: its snapshot stays the same after a new revision, and prints alone", async ({ page }) => {
  test.setTimeout(180_000);
  const stub = process.env.AI_STUB_DIR;
  expect(Boolean(stub) && isAbsolute(stub!), "Start the server with a fresh absolute AI_STUB_DIR").toBe(true);
  const fixtures = join(__dirname, "fixtures");
  for (const f of await readdir(fixtures)) await copyFile(join(fixtures, f), join(stub!, f));
  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("button", { name: "Interpret" }).click();
  const saved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/ideas" && r.request().method() === "POST", { timeout: 60_000 });
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();
  // Choosing a version generates its neighbours' evidence first (#181): one fixture per neighbour, nothing claimed.
  for (const id of ((await (await saved).json()) as { neighborIds: string[] }).neighborIds)
    await writeFile(join(stub!, `evidence-${id}.json`), JSON.stringify({ overlaps: [], differences: [], uncertainty: { text: "Not stated on the page", label: "unverified", sourceIds: [] } }));
  const revisions = page.getByRole("region", { name: "Revisions" });
  await expect(revisions).toHaveAttribute("data-trail-length", "1", { timeout: 60_000 });
  const v1 = (await revisions.getAttribute("data-current-version"))!;

  await page.getByRole("region", { name: "Decision" }).getByRole("button", { name: "Choose this version" }).click();
  await expect(view(page)).toHaveAttribute("data-version-id", v1, { timeout: 30_000 });
  await expect(view(page)).toContainText(interpretation.title);
  await expect(view(page)).toContainText(interpretation.workflow);
  // The view shows the stored JSON: its alternatives are the snapshot's.
  const stored = await (await page.request.get(`/api/snapshots/${await view(page).getAttribute("data-snapshot-id")}`)).json();
  await expect(view(page).getByRole("listitem")).toHaveCount(stored.nearestAlternatives.length);
  const before = await view(page).innerText();

  // A new revision becomes current; the snapshot view doesn't change, and no new snapshot is saved for it.
  const isSave = (r: { url(): string; method(): string }) => new URL(r.url()).pathname === "/api/snapshots" && r.method() === "POST";
  let saves = 0;
  page.on("request", (r) => void (isSave(r) && saves++));
  await revisions.getByRole("button", { name: "Suggest revisions" }).click();
  await revisions.getByRole("list", { name: "Suggestions" }).getByRole("button", { name: "Accept" }).nth(1).click();
  await expect(revisions).toHaveAttribute("data-trail-length", "2", { timeout: 60_000 });
  const v2 = (await revisions.getAttribute("data-current-version"))!;
  expect(v2).not.toBe(v1);
  // The Decide panel itself has moved to the new version, and saves no new snapshot for it. (networkidle never
  // settles now that other panels keep requesting, so wait on these signals instead.)
  await expect(page.getByRole("region", { name: "Decision" })).toHaveAttribute("data-active-version", v2, { timeout: 30_000 });
  // Give a late save time to start (an effect reacting to the version would fire here), then check none did.
  await page.waitForRequest(isSave, { timeout: 5_000 }).catch(() => null);
  expect(saves, "A new version must not save a new snapshot").toBe(0);
  await expect(view(page)).toHaveAttribute("data-version-id", v1);
  expect(await view(page).innerText()).toBe(before);
  await page.screenshot({ path: test.info().outputPath("snapshot.png"), fullPage: true });

  // Printing shows only the snapshot.
  await page.emulateMedia({ media: "print" });
  await expect(view(page)).toBeVisible();
  await expect(revisions).toBeHidden();
  await expect(page.locator("canvas")).toBeHidden();
  await page.screenshot({ path: test.info().outputPath("print.png") });
});
