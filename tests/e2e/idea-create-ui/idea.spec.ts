import { expect, test, type Page } from "@playwright/test";
import fixture from "./fixtures/idea-interpret.json";

// Gemini is stubbed on the server through AI_STUB_DIR (this folder's fixtures); saving uses the real embedding
// model and the Neon test branch, so the star lands at its real position among real neighbors.
test.use({ trace: "off" }); // traces would hold the session cookie
const typed = "Help hackathon teammates plan shared meals. Collect dietary constraints and choose a meal together.";
const CYAN: [number, number, number] = [79, 214, 232]; // STYLE.idea in components/galaxy/stars.ts
const AMBER: [number, number, number] = [245, 181, 74]; // STYLE.highlighted

// Counts pixels of one colour in a screenshot of the galaxy area: what the user sees, not internal state. The area
// includes overlays (the reveal slider is cyan too), so checks compare against a baseline taken before saving.
async function pixels(page: Page, [r, g, b]: [number, number, number]) {
  const png = (await page.locator("canvas").screenshot()).toString("base64");
  return page.evaluate(
    async ({ png, r, g, b }) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
      const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const d = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - r) + Math.abs(d[i + 1] - g) + Math.abs(d[i + 2] - b) < 30) n++;
      return n;
    },
    { png, r, g, b },
  );
}

const idea = (page: Page) => page.getByRole("region", { name: "Your idea" });

test("type, correct and save an idea; it becomes a cyan star among highlighted neighbors and survives reload", async ({ page }) => {
  test.setTimeout(120_000);
  expect(process.env.AI_STUB_DIR, "Start the server with AI_STUB_DIR=tests/e2e/idea-create-ui/fixtures").toBeTruthy();
  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("textbox", { name: "Describe your idea" }).fill(typed);
  await page.getByRole("button", { name: "Interpret" }).click();

  // The interpretation is an editable preview.
  const title = idea(page).getByRole("textbox", { name: "Title" });
  await expect(title).toHaveValue(fixture.title);
  await expect(idea(page).getByRole("textbox", { name: "Audience" })).toHaveValue(fixture.audience);
  await expect(idea(page).getByRole("textbox", { name: "Constraints" })).toHaveValue("");
  await page.waitForTimeout(500);
  const cyanBefore = await pixels(page, CYAN);
  const amberBefore = await pixels(page, AMBER);
  await title.fill("Team meal planner");
  await idea(page).getByRole("button", { name: "Save" }).click();

  await expect(idea(page).getByRole("heading")).toHaveText("Team meal planner", { timeout: 60_000 });
  const versionId = await idea(page).getAttribute("data-version-id");
  const position = await idea(page).getAttribute("data-position");
  expect(versionId).toMatch(/^[0-9a-f-]{36}$/);
  await expect.poll(() => pixels(page, CYAN), { message: "a cyan idea star" }).toBeGreaterThan(cyanBefore + 50);
  await expect.poll(() => pixels(page, AMBER), { message: "highlighted neighbors" }).toBeGreaterThan(amberBefore + 50);
  await page.screenshot({ path: test.info().outputPath("saved.png") });

  await page.reload();
  await expect(idea(page)).toHaveAttribute("data-version-id", versionId!, { timeout: 30_000 });
  await expect(idea(page)).toHaveAttribute("data-position", position!);
  await expect.poll(() => pixels(page, CYAN), { message: "the star is back after reload" }).toBeGreaterThan(cyanBefore + 50);
});

test("a failed interpretation keeps the typed text for filling in by hand", async ({ page }) => {
  await page.route("**/api/ideas/interpret", (r) => r.fulfill({ status: 502, json: { error: "unavailable" } }));
  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill(typed);
  await page.getByRole("button", { name: "Interpret" }).click();
  await expect(idea(page).getByRole("alert")).toContainText("Couldn't interpret your idea");
  await expect(idea(page).getByRole("textbox", { name: "Description" })).toHaveValue(typed);
  await idea(page).getByRole("textbox", { name: "Title" }).fill("Typed by hand");
  await expect(idea(page).getByRole("textbox", { name: "Title" })).toHaveValue("Typed by hand");
  await expect(idea(page).getByRole("button", { name: "Save" })).toBeEnabled();
});
