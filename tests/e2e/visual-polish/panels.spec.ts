import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// A real record from the corpus fixture, which the loaded corpus contains (changes/corpus-embed.md).
const record = JSON.parse(readFileSync("corpus/fixtures/sample.jsonl", "utf8").split("\n")[0]) as { title: string };

const PANELS = ["search", "drawer", "explainer", "voice"] as const;

async function openEveryPanel(page: Page) {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search projects" }).fill(record.title);
  const similar = page.getByRole("list", { name: "Similar projects" });
  await similar.getByRole("button").first().click();
  await expect(page.getByRole("region", { name: "Project" }).getByRole("heading")).toHaveText(record.title);
  await page.getByText("What am I looking at?").click();
  for (const p of PANELS) await expect(page.locator(`[data-panel="${p}"]`)).toBeVisible();
}

test("search, drawer, explainer and voice panels share the panel tokens", async ({ page }) => {
  await openEveryPanel(page);
  const styles = await page.evaluate((panels) => {
    // Resolve each token through the browser, so the comparison is in the same rgb()/px units as computed styles.
    const probe = document.createElement("div");
    document.body.append(probe);
    probe.style.cssText = "background: var(--panel); border: 1px solid var(--border); font-size: var(--heading)";
    const cs = getComputedStyle(probe);
    const tokens = { background: cs.backgroundColor, border: cs.borderTopColor, heading: cs.fontSize };
    probe.remove();
    const found = Object.fromEntries(
      panels.map((p) => {
        const el = document.querySelector(`[data-panel="${p}"]`)!;
        const h = el.querySelector("h2, summary");
        const s = getComputedStyle(el);
        return [p, { background: s.backgroundColor, border: s.borderTopColor, heading: h ? getComputedStyle(h).fontSize : null }];
      }),
    );
    return { tokens, found };
  }, PANELS);

  for (const p of PANELS) expect(styles.found[p], p).toEqual(styles.tokens);
  await page.screenshot({ path: test.info().outputPath("desktop.png") });
});

test("phone width evidence", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEveryPanel(page);
  await page.screenshot({ path: test.info().outputPath("phone.png"), fullPage: true });
});
