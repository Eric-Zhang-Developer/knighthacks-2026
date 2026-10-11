import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { findTwins, TWINS } from "../../../components/scan/story";

// The story (specs/features/idea-scan, Plan 5, Validation 8) on the committed corpus: nothing routed, the twins are
// found in stars.json by exact title and year, and the proof's sheet is the project's own record.
type Star = { id: string; title: string; event: string | null; year: number | null };
const stars: Star[] = JSON.parse(readFileSync("public/corpus/stars.json", "utf8")).stars;
const twins = findTwins(stars);
const galaxy = (page: Page) => page.locator("[data-star-count]");
const tags = (page: Page) => page.getByRole("group", { name: "Nearest projects to your idea" }).locator("button[data-on]");
const shots = "story";

// Software GL draws a few frames a second, so record every beat the galaxy passes through rather than polling.
async function recordBeats(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { beats: string[] };
    w.beats = [];
    new MutationObserver(() => {
      const v = document.querySelector("[data-star-count]")?.getAttribute("data-story");
      if (v && w.beats.at(-1) !== v) w.beats.push(v);
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-story"] });
  });
}
const beats = (page: Page) => page.evaluate(() => (window as unknown as { beats: string[] }).beats);
// Where the twins are drawn now, in canvas pixels, and the canvas size.
const twinsOnScreen = (page: Page) =>
  page.locator("canvas").evaluate((c, idx) => {
    const pts = (c as HTMLCanvasElement & { starScreen: (i: number[]) => { x: number; y: number }[] }).starScreen(idx);
    const r = c.getBoundingClientRect();
    return pts.filter((p) => p.x > 0 && p.y > 0 && p.x < r.width && p.y < r.height).length;
  }, twins.map((t) => t.index));

async function start(page: Page) {
  await page.goto("/");
  await expect(galaxy(page)).toHaveAttribute("data-classes", "ready", { timeout: 20_000 });
  await page.getByRole("button", { name: "Play the story" }).click();
  await expect(galaxy(page)).toHaveAttribute("data-story", "sky");
}

test("the corpus has all three twins", () => {
  expect(twins.map((t) => [t.title, t.year])).toEqual(TWINS.map((w) => [w.title, w.year]));
});

test("Play the story: sky, egg, twins, proof, turn, idle; three real twins reached; the last one's sheet opens", async ({ page }, info) => {
  test.setTimeout(90_000);
  await recordBeats(page);
  await start(page);
  await expect(page.locator("html")).toHaveAttribute("data-story", "play");
  await expect(page.getByRole("region", { name: "Survey" })).toHaveCount(0); // the overlay counts instead
  // Unattended, the sky runs into the egg at 7 s.
  await expect(galaxy(page)).toHaveAttribute("data-story", "egg", { timeout: 10_000 });
  // Space pauses: the egg (5 s long) is still showing well after it would have ended.
  await page.keyboard.press(" ");
  await expect(page.locator("html")).toHaveAttribute("data-story", "paused");
  await page.waitForTimeout(6_000);
  await expect(galaxy(page)).toHaveAttribute("data-story", "egg");
  await page.screenshot({ path: info.outputPath(`${shots}-egg.png`) });
  await page.keyboard.press(" ");
  await expect(page.locator("html")).toHaveAttribute("data-story", "play");

  await page.keyboard.press("ArrowRight");
  await expect(galaxy(page)).toHaveAttribute("data-story", "twins");
  // One by one, each twin's tag appears as its arc lands: title, then event · year, never a similarity.
  await expect(tags(page)).toHaveCount(1, { timeout: 5_000 });
  await expect(tags(page)).toHaveCount(3, { timeout: 8_000 });
  const texts = (await tags(page).allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  expect(texts).toEqual(twins.map((t) => `${t.title} ${[t.event, t.year].filter((v) => v != null).join(" · ")}`));
  expect(await twinsOnScreen(page)).toBe(3);
  await page.screenshot({ path: info.outputPath(`${shots}-twins.png`) });

  await page.keyboard.press("ArrowRight");
  await expect(galaxy(page)).toHaveAttribute("data-story", "proof");
  const last = twins.at(-1)!;
  await expect(galaxy(page)).toHaveAttribute("data-selected-id", last.id);
  const sheet = page.getByRole("region", { name: "Project" });
  await expect(sheet.getByRole("heading", { name: last.title })).toBeVisible({ timeout: 10_000 });
  await expect(sheet.getByRole("link", { name: /^Source:/ })).toHaveAttribute("href", /devpost\.com/);
  await page.screenshot({ path: info.outputPath(`${shots}-proof.png`) });

  await page.keyboard.press("ArrowRight");
  await expect(galaxy(page)).toHaveAttribute("data-story", "turn");
  await expect(galaxy(page)).toHaveAttribute("data-selected-id", "");
  await page.keyboard.press("ArrowRight"); // past the last beat, the story ends
  await expect(galaxy(page)).toHaveAttribute("data-story", "idle");
  await expect(page.locator("html")).not.toHaveAttribute("data-story");
  expect((await beats(page)).filter((b, i) => !(i === 0 && b === "idle"))).toEqual(["sky", "egg", "twins", "proof", "turn", "idle"]);
  await expect(tags(page)).toHaveCount(0);
});

test("ArrowLeft steps back and replays the beat; Escape mid-story restores everything", async ({ page }) => {
  test.setTimeout(60_000);
  await start(page);
  for (const b of ["egg", "twins", "proof"]) {
    await page.keyboard.press("ArrowRight");
    await expect(galaxy(page)).toHaveAttribute("data-story", b);
  }
  await expect(galaxy(page)).toHaveAttribute("data-selected-id", twins.at(-1)!.id);
  await page.keyboard.press("ArrowLeft");
  await expect(galaxy(page)).toHaveAttribute("data-story", "twins");
  await expect(galaxy(page)).toHaveAttribute("data-selected-id", "");
  await page.keyboard.press("ArrowRight");
  await expect(galaxy(page)).toHaveAttribute("data-selected-id", twins.at(-1)!.id);
  await page.keyboard.press("Escape");
  await expect(galaxy(page)).toHaveAttribute("data-story", "idle");
  await expect(galaxy(page)).toHaveAttribute("data-selected-id", "");
  await expect(galaxy(page)).toHaveAttribute("data-scan", "idle");
  await expect(tags(page)).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-story");
});

test("a drag on the map pauses the story rather than skipping it", async ({ page }) => {
  await start(page);
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 10);
  await page.mouse.up();
  await expect(page.locator("html")).toHaveAttribute("data-story", "paused");
  await expect(galaxy(page)).toHaveAttribute("data-story", "sky");
  await expect(galaxy(page)).toHaveAttribute("data-intro", "play"); // held, not skipped to done
});

test("/?story plays on its own; reduced motion keeps the beats with the arcs already landed", async ({ browser }) => {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.goto("/?story");
  await expect(galaxy(page)).toHaveAttribute("data-story", "sky", { timeout: 20_000 });
  await page.keyboard.press("ArrowRight");
  await expect(galaxy(page)).toHaveAttribute("data-story", "egg");
  await page.keyboard.press("ArrowRight");
  await expect(galaxy(page)).toHaveAttribute("data-story", "twins");
  await expect(tags(page)).toHaveCount(3, { timeout: 2_000 }); // landed at once, no reach
  await page.keyboard.press("Escape");
  await expect(galaxy(page)).toHaveAttribute("data-story", "idle");
  await page.close();
});
