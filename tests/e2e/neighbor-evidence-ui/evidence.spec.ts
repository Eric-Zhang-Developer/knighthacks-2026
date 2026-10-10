import { neon } from "@neondatabase/serverless";
import { expect, test, type Locator } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// Real save, embeddings, evidence API and Neon test branch. Only generation is stubbed: the server reads fixtures from
// AI_STUB_DIR (a fresh absolute directory), and this test writes one per neighbor just before the server asks, since
// the neighbors are only known after the real save. HTTP traces would hold the session cookie.
test.use({ trace: "off" });
const typed = "Help hackathon teammates plan shared meals. Collect dietary constraints and choose a meal together.";
const interpretation = {
  title: "Team meal planner", description: "Help hackathon teams plan shared meals around their dietary constraints.",
  audience: "Hackathon teammates", problem: "Coordinating meals while building together",
  workflow: "Collect each teammate's dietary constraints and choose a shared meal", constraints: null,
};

// The shared ClaimBadge: a shape plus the label as a word, so colour is never the only signal.
const badge = (scope: Locator, label: string) => scope.locator(`[data-label="${label}"]`);

test("a saved idea gets labelled evidence cards whose links open the right project", async ({ page }) => {
  test.setTimeout(180_000);
  const stub = process.env.AI_STUB_DIR;
  expect(Boolean(stub) && isAbsolute(stub!), "Start the server with a fresh absolute AI_STUB_DIR").toBe(true);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must both use the test branch").toBe(true);
  const sql = neon(process.env.TEST_DATABASE_URL!);
  await writeFile(join(stub!, "idea-interpret.json"), JSON.stringify(interpretation));

  const projects = new Map<string, { title: string; url: string }>();
  let failNext = true; // the first evidence request fails, to check the failure state and Retry
  await page.route("**/api/evidence/**", async (route) => {
    if (failNext) {
      failNext = false;
      return route.fulfill({ status: 502, json: { error: "Evidence generation is temporarily unavailable." } });
    }
    const versionId = new URL(route.request().url()).pathname.split("/").pop()!;
    const rows = await sql`select p.id, p.title, p.url, coalesce(nullif(trim(p.description), ''), nullif(trim(p.tagline), ''), p.title) as excerpt
      from idea_versions v cross join unnest(v.neighbor_ids) as n(id) join projects p on p.id = n.id where v.id = ${versionId}::uuid`;
    for (const row of rows) {
      projects.set(row.id, { title: row.title, url: row.url });
      const claim = (text: string, label: string, sourceIds = [row.id]) => ({ text, label, sourceIds });
      await writeFile(join(stub!, `evidence-${row.id}.json`), JSON.stringify({
        overlaps: [claim(String(row.excerpt).trim().slice(0, 40).trim(), "supported"), claim("Both are built for a team working together.", "inferred")],
        differences: [claim("It does not mention dietary constraints.", "inferred")],
        uncertainty: claim("Whether it was ever used at an event is unknown.", "unverified", []),
      }));
    }
    await route.continue();
  });

  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill(typed);
  await page.getByRole("button", { name: "Interpret" }).click();
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();

  const evidence = page.getByRole("region", { name: "Evidence" });
  await expect(evidence.getByRole("alert")).toContainText("Couldn't load evidence", { timeout: 60_000 });
  await evidence.getByRole("button", { name: "Retry" }).click();

  // Top three neighbors first; each card's labels are words, not only colour, and its link is the project's source.
  const cards = evidence.getByRole("article");
  await expect(cards).toHaveCount(3, { timeout: 60_000 });
  for (const card of await cards.all()) {
    const project = projects.get((await card.getAttribute("data-project-id"))!)!;
    await expect(card.getByRole("button", { name: project.title })).toBeVisible();
    await expect(card.getByRole("link", { name: /Source/ })).toHaveAttribute("href", project.url);
    await expect(badge(card, "supported")).toHaveText(/supported/);
    await expect(badge(card, "supported")).toBeVisible();
    await expect(badge(card, "inferred").first()).toHaveText(/inferred/);
    await expect(badge(card, "unverified")).toBeHidden(); // uncertainty starts collapsed
  }
  await cards.first().getByText("Uncertainty and source excerpt").click();
  await expect(badge(cards.first(), "unverified")).toBeVisible();
  await expect(badge(cards.first(), "unverified")).toHaveText(/unverified/);

  // A card's title opens that project in the drawer.
  const second = cards.nth(1);
  const secondTitle = projects.get((await second.getAttribute("data-project-id"))!)!.title;
  await second.getByRole("button", { name: secondTitle }).click();
  await expect(page.getByRole("region", { name: "Project" }).getByRole("heading", { name: secondTitle })).toBeVisible();

  await evidence.getByRole("button", { name: "Compare the remaining neighbors" }).click();
  await expect(cards).toHaveCount(5, { timeout: 60_000 });
  await expect(evidence.getByRole("button", { name: "Compare the remaining neighbors" })).toHaveCount(0);
  await cards.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("evidence.png") });

  // Stored cards come back after a reload.
  await page.reload();
  await expect(page.getByRole("region", { name: "Evidence" }).getByRole("article")).toHaveCount(5, { timeout: 60_000 });
});
