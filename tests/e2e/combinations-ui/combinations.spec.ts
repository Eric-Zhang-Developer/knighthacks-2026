import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import interpretation from "../idea-create-ui/fixtures/idea-interpret.json";

// Gemini is stubbed through AI_STUB_DIR: the combinations fixture is written from the saved version's real
// neighbors once it exists. Embeddings and Neon are real. Traces would hold the session cookie.
test.use({ trace: "off" });

test("a saved idea gets combinations of two real neighbors, each linked, labelled and opening the drawer", async ({ page }) => {
  test.setTimeout(180_000);
  const stub = process.env.AI_STUB_DIR;
  expect(Boolean(stub) && isAbsolute(stub!), "Start the server with a fresh absolute AI_STUB_DIR").toBe(true);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must both use the test branch").toBe(true);
  const sql = neon(process.env.TEST_DATABASE_URL!);
  await writeFile(join(stub!, "idea-interpret.json"), JSON.stringify(interpretation));
  // The evidence cards and strongest alternative have their own suites; keep them out of this one.
  for (const path of ["**/api/evidence/**", "**/api/alternative/**"]) await page.route(path, (r) => r.abort());

  const sources: { id: string; title: string; url: string }[] = [];
  await page.route("**/api/combinations/**", async (route) => {
    if (route.request().method() === "POST" && !sources.length) {
      const versionId = new URL(route.request().url()).pathname.split("/").pop()!;
      const rows = await sql`select p.id, p.title, p.url, coalesce(nullif(trim(p.description), ''), nullif(trim(p.tagline), ''), p.title) as excerpt
        from idea_versions v cross join unnest(v.neighbor_ids) with ordinality as n(id, i) join projects p on p.id = n.id
        where v.id = ${versionId}::uuid order by n.i limit 4`;
      sources.push(...rows.map((r) => ({ id: r.id, title: r.title, url: r.url })));
      const quote = String(rows[0].excerpt).trim().slice(0, 40).trim();
      const pair = (a: number, b: number, user: string) => ({
        user,
        benefit: { text: quote, label: "supported", sourceIds: [rows[a].id] },
        workflow: ["Collect what each teammate can eat", "Match it against what the other project already lists", "Pick one shared order"],
        sourceIds: [rows[a].id, rows[b].id],
        claims: [{ text: "Both projects start from a list the user fills in.", label: "inferred", sourceIds: [rows[a].id, rows[b].id] }],
      });
      await writeFile(join(stub!, "combinations.json"), JSON.stringify({ suggestions: [pair(0, 1, "A hackathon team ordering dinner"), pair(2, 3, "A dorm floor sharing groceries")] }));
    }
    await route.continue();
  });

  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("button", { name: "Interpret" }).click();
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();

  // Collapsed to the first suggestion: its two real sources are linked, and every claim is labelled.
  const panel = page.getByRole("region", { name: "Combine ideas" });
  const first = panel.getByRole("article", { name: "Combination for A hackathon team ordering dinner" });
  await expect(first).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByRole("article")).toHaveCount(1);
  const links = first.getByRole("list", { name: "Source projects" }).getByRole("listitem");
  await expect(links).toHaveCount(2);
  for (const [i, s] of sources.slice(0, 2).entries()) {
    await expect(links.nth(i).getByRole("button", { name: s.title })).toBeVisible();
    await expect(links.nth(i).getByRole("link", { name: /Source/ })).toHaveAttribute("href", s.url);
  }
  await expect(first.locator('[data-label="supported"]')).toHaveCount(1);
  await expect(first.locator('[data-label="inferred"]')).toHaveCount(1);
  await expect(first).toContainText("Proposed workflow");
  await expect(first.getByRole("listitem").filter({ hasText: "Pick one shared order" })).toBeVisible();

  // Expand for the rest.
  await panel.getByRole("button", { name: "Show one more combination" }).click();
  await expect(panel.getByRole("article")).toHaveCount(2);
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("combinations.png") });

  // A source opens the project drawer on that project.
  await links.nth(1).getByRole("button", { name: sources[1].title }).click();
  await expect(page.getByRole("region", { name: "Project" }).getByRole("heading", { name: sources[1].title })).toBeVisible();
});
