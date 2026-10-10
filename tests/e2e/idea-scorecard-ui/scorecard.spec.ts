import { expect, test } from "@playwright/test";
import { access, readFile, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// The real scorecard route, with model output from AI_STUB_DIR: the idea from the committed interpret fixture, empty
// evidence for the saved idea's real neighbours, and a scorecard citing the first of them. No corpus record is invented.
const committed = join(process.cwd(), "tests/e2e/idea-create-ui/fixtures/idea-interpret.json");
const point = (text: string, sourceIds: string[] = [], label = "inferred") => ({ text, label, sourceIds });
const KEYS = ["originality", "technicalUnderstanding", "functionality", "design", "wowFactor"];
const NAMES = ["Originality", "Technical Understanding", "Functionality", "Design", "Wow Factor"];

test("five criteria rows with scores and worded reasons; a cited project opens the drawer", async ({ page }, info) => {
  test.setTimeout(180_000);
  const stub = process.env.AI_STUB_DIR;
  expect(Boolean(stub) && isAbsolute(stub!), "Start the server with an absolute AI_STUB_DIR").toBe(true);
  const wrote: string[] = [];
  const put = async (name: string, body: string) => {
    await writeFile(join(stub!, name), body);
    wrote.push(join(stub!, name));
  };
  if (!(await access(join(stub!, "idea-interpret.json")).then(() => true, () => false))) await put("idea-interpret.json", await readFile(committed, "utf8"));
  try {
    await page.goto("/");
    const card = page.getByRole("region", { name: "Your idea" });
    await card.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
    await card.getByRole("button", { name: "Interpret" }).click();
    const saved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/ideas" && r.request().method() === "POST");
    await card.getByRole("button", { name: "Save" }).click({ timeout: 60_000 });
    const { versionId, neighborIds } = (await (await saved).json()) as { versionId: string; neighborIds: string[] };
    const [n1] = neighborIds;
    for (const id of neighborIds)
      await put(`evidence-${id}.json`, JSON.stringify({ overlaps: [], differences: [], uncertainty: point("Not stated on the page", [], "unverified") }));
    // Originality keeps only cited points, so both its sides cite the neighbour; Design has no point against, so the
    // route returns it as "evidence is insufficient" with no score.
    await put(`scorecard-${versionId}.json`, JSON.stringify(Object.fromEntries(KEYS.map((k, i) => [k, {
      score: i + 1,
      for: [point(`${NAMES[i]} reason for`, i === 0 ? [n1] : [], i === 0 ? "supported" : "inferred")],
      against: k === "design" ? [] : [point(`${NAMES[i]} reason against`, i === 0 ? [n1] : [])],
    }]))));

    // 1. Five rows in rubric order, each with its score as text and its reasons behind a disclosure.
    const panel = page.getByRole("region", { name: "Scorecard" });
    const scored = page.waitForResponse((r) => new URL(r.url()).pathname === `/api/scorecard/${versionId}` && r.request().method() === "POST", { timeout: 90_000 });
    await panel.getByRole("button", { name: "Score this idea" }).click();
    const result = (await (await scored).json()) as { sources: { projectId: string; title: string }[] };
    const rows = panel.getByRole("list", { name: "Criteria" }).getByRole("listitem").filter({ has: page.locator("summary") });
    await expect(rows).toHaveCount(5);
    expect(await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-criterion")))).toEqual(NAMES);
    await expect(rows.nth(0).locator("summary")).toContainText("1 out of 5");
    await expect(rows.nth(4).locator("summary")).toContainText("5 out of 5");
    await expect(rows.nth(3).locator("summary")).toContainText("evidence is insufficient");
    await expect(rows.nth(3).locator("meter")).toHaveCount(0);
    await expect(panel.locator("meter")).toHaveCount(4);
    await expect(panel).not.toContainText(/total|odds|chance of winning/i);
    const first = rows.nth(0);
    await first.locator("summary").click();
    // Labels are the route's: a point citing a stored source reads supported, an uncited one inferred.
    await expect(first.getByRole("list", { name: "For" })).toContainText("supported Originality reason for");
    await expect(first.getByRole("list", { name: "Against" })).toContainText("supported Originality reason against");
    await rows.nth(1).locator("summary").click();
    await expect(rows.nth(1).getByRole("list", { name: "Against" })).toContainText("inferred Technical Understanding reason against");
    // A page shot: an element shot inside the shell's scrolling column captures the wrong pixels.
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("scorecard.png") });

    // 2. The cited neighbour is a button named by its card title; it opens that project in the drawer.
    const title = result.sources.find((s) => s.projectId === n1)?.title;
    expect(title, "the scorecard names the project it cites").toBeTruthy();
    await first.getByRole("list", { name: "For" }).getByRole("button", { name: title }).click();
    const drawer = page.getByRole("region", { name: "Project" });
    await expect(drawer).toContainText(title!);
    await drawer.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("drawer.png") });
  } finally {
    await Promise.all(wrote.map((f) => unlink(f).catch(() => {})));
  }
});
