import { expect, test, type Locator, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";

// The judge's demo path, end to end, with live model calls (no AI_STUB_DIR). Set DEMO_BASE_URL to run it against
// production instead of the local server. Screenshots mask every invite link, share link and QR code; no trace, and
// no automatic end-of-test screenshot, since either would capture them.
test.use({ trace: "off", screenshot: "off", ...(process.env.DEMO_BASE_URL ? { baseURL: process.env.DEMO_BASE_URL } : {}) });
const region = (page: Page, name: string) => page.getByRole("region", { name });
const LABELS = ["supported", "inferred", "unverified"];

test("type an idea, see evidence, challenge, revise, branch, vote as two, choose, share to a phone", async ({ browser, baseURL }) => {
  test.setTimeout(480_000);
  expect(process.env.AI_STUB_DIR, "the demo path runs live models").toBeFalsy();
  const origin = new URL(baseURL!).origin;
  const times: Record<string, number> = {};
  let t = Date.now(), n = 0;
  const secrets: Locator[] = [];
  async function step(name: string, page: Page, run: () => Promise<void>) {
    await test.step(name, run);
    times[name] = Date.now() - t;
    await page.screenshot({ path: test.info().outputPath(`${String(++n).padStart(2, "0")}-${name}.png`), fullPage: true, mask: secrets });
    t = Date.now();
  }

  const ctxA = await browser.newContext({ baseURL: origin });
  const a = await ctxA.newPage();
  secrets.push(a.getByRole("textbox", { name: "Invite link" }), a.locator("[data-share-url]"), a.getByRole("img", { name: /QR code/ }));

  await step("idea", a, async () => {
    await a.goto("/");
    await expect(a.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
    await expect(a.locator("[data-star-count]")).not.toHaveAttribute("data-star-count", "0", { timeout: 30_000 });
    await a.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals around everyone's dietary constraints.");
    await a.getByRole("button", { name: "Interpret" }).click();
    await region(a, "Your idea").getByRole("button", { name: "Save", exact: true }).click({ timeout: 90_000 });
    await expect(region(a, "Revisions")).toHaveAttribute("data-trail-length", "1", { timeout: 60_000 });
    // Saved and placed: the idea is a star at its embedded position.
    await expect(region(a, "Your idea")).toHaveAttribute("data-position", /\S/);
  });

  await step("evidence", a, async () => {
    const cards = region(a, "Evidence").getByRole("article");
    await expect(cards.first()).toBeVisible({ timeout: 120_000 });
    // Every claim carries a word label, not only a colour.
    for (const card of await cards.all()) {
      await expect(card.getByRole("listitem")).not.toHaveCount(0);
      expect(await card.getByRole("listitem").count()).toBe(await card.getByRole("listitem").locator("[data-label]").count());
      for (const label of await card.locator("[data-label]").evaluateAll((els) => els.map((e) => e.getAttribute("data-label"))))
        expect(LABELS).toContain(label);
    }
  });

  await step("challenge", a, async () => {
    const challenge = region(a, "Challenge");
    await challenge.getByRole("button", { name: "Challenge my idea" }).click();
    const round = challenge.getByRole("list", { name: "Rounds" }).getByRole("listitem");
    await expect(round).toHaveCount(1, { timeout: 90_000 });
    await expect(round.first()).toContainText("Assumption:");
    await challenge.getByRole("textbox", { name: "Your answer" }).fill("We'd try it at the next team dinner and count who eats.");
    await challenge.getByRole("button", { name: "Answer" }).click();
    await expect(round.first()).toContainText("Outcome:", { timeout: 90_000 });
  });

  let chosen = "";
  await step("revision", a, async () => {
    const revisions = region(a, "Revisions");
    await revisions.getByRole("button", { name: "Suggest revisions" }).click();
    await revisions.getByRole("list", { name: "Suggestions" }).getByRole("button", { name: "Accept" }).first().click({ timeout: 90_000 });
    await expect(revisions).toHaveAttribute("data-trail-length", "2", { timeout: 60_000 });
    chosen = (await revisions.getAttribute("data-current-version"))!;
  });

  await step("branch", a, async () => {
    const branches = region(a, "Branches");
    await branches.getByRole("button", { name: "Suggest directions" }).click();
    // A version becomes a branch once it has a sibling, so take two directions.
    const directions = branches.getByRole("list", { name: "Directions" }).getByRole("listitem");
    await expect(directions.first()).toBeVisible({ timeout: 90_000 });
    for (let i = 1; i <= 2; i++) {
      const before = await directions.count();
      await directions.first().getByRole("button", { name: "Branch this way" }).click();
      await expect(directions).toHaveCount(before - 1, { timeout: 60_000 });
    }
    await expect(branches).toHaveAttribute("data-branch-count", "2", { timeout: 60_000 });
    await expect(branches).toHaveAttribute("data-branch-stars", "2");
  });

  const ctxB = await browser.newContext({ baseURL: origin });
  const b = await ctxB.newPage();
  await step("teammate-joins", b, async () => {
    await region(a, "Workspace").getByRole("button", { name: "Invite a teammate" }).click();
    const invite = await a.getByRole("textbox", { name: "Invite link" }).inputValue();
    await a.getByRole("button", { name: "Done" }).click();
    await b.goto(new URL(invite).pathname);
    await b.getByRole("button", { name: "Join" }).click();
    await expect(region(b, "Invite")).toContainText("You joined workspace");
    await b.getByRole("link", { name: "Open the galaxy" }).click();
    await expect(region(b, "Team vote")).toBeVisible({ timeout: 30_000 });
  });

  await step("vote", b, async () => {
    const concern = "Allergies might rule out one shared order";
    await region(a, "Team vote").getByRole("combobox", { name: "Preferred version" }).selectOption(chosen);
    await region(a, "Team vote").getByRole("textbox", { name: "One concern" }).fill(concern);
    await region(a, "Team vote").getByRole("button", { name: "Vote" }).click();
    await expect(region(a, "Team vote").getByRole("status", { name: "Vote result" })).toContainText("Waiting for your teammate");
    // No early reveal: after more than one poll, B sees nothing of A's vote.
    await b.waitForTimeout(5000);
    await expect(region(b, "Team vote")).not.toContainText(concern);
    await expect(region(b, "Team vote").getByRole("status", { name: "Vote result" })).toHaveCount(0);
    await region(b, "Team vote").getByRole("button", { name: "Vote" }).click();
    for (const page of [a, b]) {
      const result = region(page, "Team vote").getByRole("status", { name: "Vote result" });
      await expect(result).toContainText(/You agree\.|You picked different versions\./, { timeout: 15_000 });
      await expect(result.locator('[data-vote="Teammate"]')).toBeVisible();
    }
  });

  let title = "";
  await step("snapshot", a, async () => {
    await region(a, "Decision").getByRole("button", { name: /Choose (this|the current) version/ }).click();
    const snapshot = a.getByRole("article", { name: "Decision snapshot" });
    await expect(snapshot).toBeVisible({ timeout: 30_000 });
    await snapshot.scrollIntoViewIfNeeded();
    title = (await snapshot.getByRole("heading", { level: 3 }).innerText()).trim();
    expect(title).not.toBe("");
  });

  const phone = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, isMobile: true });
  const visitor = await phone.newPage();
  await step("share-on-phone", visitor, async () => {
    await region(a, "Share").getByRole("button", { name: "Create a read-only link" }).click();
    const link = a.locator("[data-share-url]");
    await expect(link).toHaveText(/\/s\/[^/]+$/);
    await visitor.goto(new URL((await link.textContent())!).pathname);
    await expect(visitor.getByRole("article", { name: "Shared decision" }).getByRole("heading", { level: 1 })).toHaveText(title, { timeout: 30_000 });
    await visitor.waitForLoadState("networkidle");
    expect(await phone.cookies(), "the share page must not set a workspace cookie").toEqual([]);
  });

  writeFileSync(test.info().outputPath("timings.json"), JSON.stringify({ origin, ms: times }, null, 2));
  await Promise.all([ctxA.close(), ctxB.close(), phone.close()]);
});
