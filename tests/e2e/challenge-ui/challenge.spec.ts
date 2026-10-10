import { copyFile, readdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import proposal from "./fixtures/revision-propose.json";

// Gemini is stubbed through AI_STUB_DIR, a fresh absolute temp folder: this test copies its static fixtures in and
// writes round 1's, which must quote a real neighbor of the saved idea. Embeddings and Neon are real.
test.use({ trace: "off" }); // traces would hold the session cookie
const fixtures = join(__dirname, "fixtures");
const panel = (page: Page) => page.getByRole("region", { name: "Challenge" });
const rounds = (page: Page) => panel(page).getByRole("list", { name: "Rounds" }).getByRole("listitem").filter({ hasText: /^Round/ });

async function answer(page: Page, text: string) {
  await panel(page).getByRole("textbox", { name: "Your answer" }).fill(text);
  await panel(page).getByRole("button", { name: "Answer" }).click();
}

for (const format of ["legacy", "claim"] as const) test(`${format} revision reasons have labels; three rounds and accept still work`, async ({ page }) => {
  test.setTimeout(180_000);
  const stub = process.env.AI_STUB_DIR;
  expect(stub && isAbsolute(stub), "Set AI_STUB_DIR to a fresh absolute temp folder").toBeTruthy();
  for (const f of await readdir(fixtures)) await copyFile(join(fixtures, f), join(stub!, f));

  await page.route("**/api/revisions/propose", async (route) => {
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    const body = await response.json();
    body.suggestions = body.suggestions.map((s: { reason: string | { text: string; label: string; sourceIds: string[] } }) => {
      const claim = typeof s.reason === "string" ? { text: s.reason, label: "inferred", sourceIds: [] } : s.reason;
      return { ...s, reason: format === "legacy" ? claim.text : claim };
    });
    await route.fulfill({ response, json: body });
  });
  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("button", { name: "Interpret" }).click();
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("region", { name: "Revisions" })).toHaveAttribute("data-trail-length", "1", { timeout: 60_000 });

  // Round 1 cites the saved idea's first real neighbor, quoted the way the server checks it.
  const [idea] = (await (await page.request.get("/api/ideas")).json()) as { versionId: string; neighborIds: string[] }[];
  const record = (await (await page.request.get(`/api/projects/${idea.neighborIds[0]}`)).json()) as Record<string, string | null>;
  const quote = [record.description, record.tagline, record.title].find((t) => t?.trim())!.trim().slice(0, 120);
  await writeFile(
    join(stub!, "challenge-round-1.json"),
    JSON.stringify({
      question: "How would your team check that the meal selection step helps them decide?",
      assumption: "Teammates can agree on a shared meal using the proposed selection step.",
      source: { text: quote, label: "supported", sourceIds: [record.id] },
      test: null,
    }),
  );

  // Round 1: perspective defaults to judge; the question names its assumption and a supported source.
  await expect(panel(page).getByRole("combobox", { name: "Critic" })).toHaveValue("judge");
  await panel(page).getByRole("button", { name: "Challenge my idea" }).click();
  await expect(rounds(page)).toHaveCount(1, { timeout: 30_000 });
  await expect(rounds(page).first()).toContainText("Assumption: Teammates can agree on a shared meal");
  await expect(rounds(page).first().getByLabel("Source")).toContainText("supported");
  await expect(rounds(page).first().getByLabel("Source")).toContainText(quote);
  await answer(page, "We'd try it at the next team dinner.");
  await expect(rounds(page).first()).toContainText("Outcome: Revise the idea");

  // Revise: suggestions are asked for with the challenge as context; accepting makes version 2.
  const proposeRequest = page.waitForRequest("**/api/revisions/propose");
  await rounds(page).first().getByRole("button", { name: "Suggest revisions for this" }).click();
  expect((await proposeRequest).postDataJSON().context).toContain("Assumption: Teammates can agree on a shared meal");
  const suggestions = panel(page).getByRole("list", { name: "Challenge suggestions" }).getByRole("listitem");
  await expect(suggestions).toHaveCount(proposal.suggestions.length);
  for (const [index, suggestion] of proposal.suggestions.entries()) {
    await expect(suggestions.nth(index)).toContainText(suggestion.reason);
    await expect(suggestions.nth(index).locator('[data-label="inferred"]')).toBeVisible();
  }
  await suggestions.first().getByRole("button", { name: "Accept" }).click();
  await expect(page.getByRole("region", { name: "Revisions" })).toHaveAttribute("data-trail-length", "2", { timeout: 60_000 });
  await expect(rounds(page).first()).toContainText("Revised: saved as a new version.");
  await expect(rounds(page).first().getByRole("button", { name: "Suggest revisions for this" })).toHaveCount(0);

  // Rounds 2 and 3, then the session ends and only a new one is offered.
  for (const [n, outcome] of [[2, "Test it"], [3, "Answered well"]] as const) {
    await panel(page).getByRole("button", { name: "Next question" }).click();
    await expect(rounds(page)).toHaveCount(n, { timeout: 30_000 });
    await expect(rounds(page).nth(n - 1)).toContainText("Assumption:");
    await expect(rounds(page).nth(n - 1).getByLabel("Source")).toContainText("unverified");
    await answer(page, `Answer ${n}`);
    await expect(rounds(page).nth(n - 1)).toContainText(`Outcome: ${outcome}`);
  }
  await expect(panel(page)).toHaveAttribute("data-step", "done");
  await expect(panel(page).getByRole("button", { name: "Next question" })).toHaveCount(0);
  await expect(panel(page).getByRole("button", { name: "New challenge" })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("challenge.png"), fullPage: true });
});
