import { expect, test, type Page } from "@playwright/test";
import tracks from "@/lib/rubric/tracks.json";
import interpretation from "./fixtures/idea-interpret.json";

// Gemini is stubbed on the server through AI_STUB_DIR (this folder's fixtures); embeddings and Neon are real.
test.use({ trace: "off" }); // traces would hold the session cookie
const overlay = (page: Page) => page.getByRole("region", { name: "Event tracks" });
const track = (page: Page, id: string) => overlay(page).locator(`[data-track-id="${id}"]`);
const column = (page: Page, id: string, name: string) => track(page, id).locator("div", { has: page.getByRole("heading", { name, exact: true }) }).last();
const chooseVersion = (page: Page) => page.getByRole("region", { name: "Decision" }).getByRole("button", { name: "Choose this version" }).click();

test("the chosen version's event tracks: labelled claims, no scores, and a proof that survives reload", async ({ page }) => {
  test.setTimeout(180_000);
  expect(process.env.AI_STUB_DIR, "Start the server with AI_STUB_DIR=tests/e2e/rubric-overlay-ui/fixtures").toBeTruthy();
  const generations: string[] = [];
  page.on("request", (r) => r.method() === "POST" && r.url().includes("/api/rubric/") && generations.push(r.url()));

  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("button", { name: "Interpret" }).click();
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("region", { name: "Revisions" })).toHaveAttribute("data-trail-length", "1", { timeout: 60_000 });
  await chooseVersion(page);
  const snapshot = page.getByRole("article", { name: "Decision snapshot" });
  const snapshotUrl = `/api/snapshots/${await snapshot.getAttribute("data-snapshot-id", { timeout: 30_000 })}`;
  const frozen = await (await page.request.get(snapshotUrl)).text();

  // One entry per track: general tracks open, sponsor and MLH tracks collapsed.
  await expect(overlay(page).locator("[data-track-id]")).toHaveCount(tracks.length, { timeout: 30_000 });
  const general = tracks.filter((t) => t.rewards !== null);
  await expect(overlay(page).locator("details[open] [data-track-id]")).toHaveCount(general.length);
  await expect(overlay(page).locator("details:not([open]) [data-track-id]")).toHaveCount(tracks.length - general.length);
  for (const t of general) await expect(column(page, t.id, "Required")).toContainText(t.rewards!);

  // "The idea says" holds only the quoted claim; a stated claim that doesn't quote the idea is shown as unverified speculation.
  await expect(column(page, "best-ai-hack", "The idea says").locator('[data-label="supported"]')).toHaveCount(1);
  const quote = "plan shared meals around their dietary constraints";
  expect(interpretation.description).toContain(quote);
  await expect(column(page, "best-ai-hack", "The idea says").locator("[data-claim]")).toHaveText(new RegExp(`supported\\s*${quote}`));
  await expect(column(page, "best-ai-hack", "Might fit").locator('[data-label="inferred"]')).toHaveCount(1);
  await overlay(page).getByText("Sponsor and MLH tracks").click();
  await expect(column(page, "neon-best-use-of-neon", "The idea says")).toContainText("Nothing in the idea's own words.");
  await expect(column(page, "neon-best-use-of-neon", "Might fit")).toContainText("Every vote is stored in a Neon database.");
  await expect(column(page, "neon-best-use-of-neon", "Might fit").locator('[data-label="unverified"]')).toHaveCount(1);
  await expect(column(page, "nvidia-best-use-of-jetson-nano", "Required")).toContainText("doesn't state a requirement");

  // Every claim carries its label, and nothing reads as a score, rank or chance of winning.
  const claims = overlay(page).locator("[data-claim]");
  await expect(claims).toHaveCount(4);
  await expect(overlay(page).locator("[data-claim]:not(:has([data-label]))")).toHaveCount(0);
  expect(await overlay(page).innerText()).not.toMatch(/\bscor|\brank|%|\bodds\b|chance of winning|will win|\b\d+\s*(\/|out of)\s*\d+/i);

  // Attach a proof to one track: it reads as the user's own, and only that track counts as shown.
  await expect(overlay(page).locator('[data-proof="attached"]')).toHaveCount(0);
  const proof = "https://example.com/demo-video";
  await expect(overlay(page).getByRole("textbox")).toHaveCount(0); // proof fields open one at a time
  await track(page, "best-ai-hack").getByRole("button", { name: "Attach proof" }).click();
  await track(page, "best-ai-hack").getByRole("textbox", { name: "Proof for Best AI Hack" }).fill(proof);
  await track(page, "best-ai-hack").getByRole("button", { name: "Save proof" }).click();
  await expect(track(page, "best-ai-hack")).toHaveAttribute("data-proof", "attached");
  await expect(track(page, "best-ai-hack")).toContainText("Your proof (yours, not checked by Uncharted)");
  await expect(track(page, "best-ai-hack").getByRole("link", { name: proof })).toHaveAttribute("href", proof);
  await expect(overlay(page).locator('[data-proof="attached"]')).toHaveCount(1);
  await overlay(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("overlay.png") });

  // The frozen snapshot is unchanged by the overlay and its proof.
  expect(await (await page.request.get(snapshotUrl)).text()).toBe(frozen);

  // Reload and choose the version again: the stored overlay comes back with its proof, without generating again.
  await page.reload();
  await expect(page.getByRole("region", { name: "Revisions" })).toHaveAttribute("data-trail-length", "1", { timeout: 60_000 });
  await chooseVersion(page);
  await expect(track(page, "best-ai-hack")).toHaveAttribute("data-proof", "attached", { timeout: 30_000 });
  await expect(track(page, "best-ai-hack").getByRole("link", { name: proof })).toBeVisible();
  expect(generations).toHaveLength(1);
});
