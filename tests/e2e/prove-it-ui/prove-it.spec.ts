import { copyFile, readdir } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import draft from "./fixtures/experiment-draft.json";

// Real backend on the Neon test branch; the model is stubbed through AI_STUB_DIR (a fresh absolute temp folder this
// test copies its fixtures into) with AI_STUB_ALLOW=1. Round 1 ends with `test`, round 2 with `revise`.
test.use({ trace: "off" }); // traces would hold the session cookie
const fixtures = join(__dirname, "fixtures");
const panel = (page: Page) => page.getByRole("region", { name: "Challenge" });
const rounds = (page: Page) => panel(page).getByRole("list", { name: "Rounds" }).getByRole("listitem").filter({ hasText: /^Round/ });
const experiments = (page: Page) => panel(page).getByRole("region", { name: "Experiments" }).getByRole("listitem");

async function answer(page: Page, text: string) {
  await panel(page).getByRole("textbox", { name: "Your answer" }).fill(text);
  await panel(page).getByRole("button", { name: "Answer" }).click();
}

test("a `test` round offers a ten-minute experiment; its recorded result survives reload", async ({ page }) => {
  test.setTimeout(180_000);
  const stub = process.env.AI_STUB_DIR;
  expect(stub && isAbsolute(stub), "Set AI_STUB_DIR to a fresh absolute temp folder").toBeTruthy();
  for (const f of await readdir(fixtures)) await copyFile(join(fixtures, f), join(stub!, f));

  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("button", { name: "Interpret" }).click();
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("region", { name: "Revisions" })).toHaveAttribute("data-trail-length", "1", { timeout: 60_000 });

  // Round 1 ends with `test`: the offer appears, and the draft has all three parts, editable, and is not run.
  await panel(page).getByRole("button", { name: "Challenge my idea" }).click();
  await expect(rounds(page)).toHaveCount(1, { timeout: 30_000 });
  await answer(page, "We'd time it at the next team dinner.");
  await expect(rounds(page).first()).toContainText("Outcome: Test it");
  await rounds(page).first().getByRole("button", { name: "Prove it in ten minutes" }).click();
  await expect(experiments(page)).toHaveCount(1, { timeout: 30_000 });
  const card = experiments(page).first();
  await expect(card).toContainText("Round 1 · Assumption: Teammates can agree on a shared meal");
  await expect(card.getByRole("textbox", { name: "Hypothesis" })).toHaveValue(draft.hypothesis);
  await expect(card.getByRole("textbox", { name: "Procedure (ten minutes)" })).toHaveValue(draft.procedure);
  await expect(card.getByRole("textbox", { name: "What to watch" })).toHaveValue(draft.observable);
  await expect(card).toContainText("unverified");
  await expect(card).toContainText("Result: Not run");
  await expect(rounds(page).first().getByRole("button", { name: "Prove it in ten minutes" })).toHaveCount(0);

  // Edit one part and save it, then record the result.
  const observable = "Minutes to name one meal, per team; under 5 for all three confirms.";
  await card.getByRole("textbox", { name: "What to watch" }).fill(observable);
  await expect(card.getByRole("button", { name: "Record result" })).toBeDisabled(); // unsaved edits first
  await card.getByRole("button", { name: "Save changes" }).click();
  await expect(card.getByRole("button", { name: "Save changes" })).toHaveCount(0);
  await card.getByRole("combobox", { name: "Result" }).selectOption("refuted");
  await card.getByRole("textbox", { name: "Note (optional)" }).fill("Two of three teams took over eight minutes.");
  await card.getByRole("button", { name: "Record result" }).click();
  await expect(card).toContainText("Result: Refuted");
  await expect(card.getByRole("textbox")).toHaveCount(0); // a recorded experiment is read-only

  // Round 2 ends with `revise`: no experiment offer.
  await panel(page).getByRole("button", { name: "Next question" }).click();
  await expect(rounds(page)).toHaveCount(2, { timeout: 30_000 });
  await answer(page, "Whoever has the strictest diet decides.");
  await expect(rounds(page).nth(1)).toContainText("Outcome: Revise the idea");
  await expect(rounds(page).nth(1).getByRole("button", { name: "Prove it in ten minutes" })).toHaveCount(0);

  // After reload the challenge rounds are gone, but the version's experiment is back with its round and result.
  await page.reload();
  await expect(experiments(page)).toHaveCount(1, { timeout: 30_000 });
  const reloaded = experiments(page).first();
  await expect(reloaded).toContainText("Round 1 · Assumption: Teammates can agree on a shared meal");
  await expect(reloaded).toContainText(draft.hypothesis);
  await expect(reloaded).toContainText(observable);
  await expect(reloaded).toContainText("Result: Refuted");
  await expect(reloaded).toContainText("Two of three teams took over eight minutes.");
  await panel(page).screenshot({ path: test.info().outputPath("prove-it.png") });
});
