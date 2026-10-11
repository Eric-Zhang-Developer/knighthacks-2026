import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// Real server, save, embeddings and Neon test branch; only generation is stubbed (AI_STUB_DIR). The summary-only
// project is a clearly fictional fixture (example.test URL, "test fixture" title, empty description) that copies a real
// neighbour's embedding so the saved idea finds it; it and the workspace are removed afterwards.
test.use({ trace: "off" }); // HTTP traces would hold the session cookie
const interpretation = {
  title: "Team meal planner", description: "Help hackathon teams plan shared meals around their dietary constraints.",
  audience: "Hackathon teammates", problem: "Coordinating meals while building together",
  workflow: "Collect each teammate's dietary constraints and choose a shared meal", constraints: null,
};
const GALLERY_LINE = "Gallery card only: Devpost lists a title and tagline; no description on record";
const GALLERY_HEADING = "From the gallery card (title and tagline only)";

for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]] as const) {
  test(`${name}: a summary-only neighbour is labelled in its evidence excerpt and its drawer; a full one isn't`, async ({ page }, info) => {
    test.setTimeout(240_000);
    await page.setViewportSize(viewport);
    const stub = process.env.AI_STUB_DIR, target = process.env.TEST_DATABASE_URL!;
    expect(Boolean(stub) && isAbsolute(stub!), "Start the server with a fresh absolute AI_STUB_DIR").toBe(true);
    expect(Boolean(target) && process.env.DATABASE_URL === target, "App and verifier must both use the test branch").toBe(true);
    const sql = neon(target);
    await writeFile(join(stub!, "idea-interpret.json"), JSON.stringify(interpretation));
    const marker = `zz-summary-only-${randomBytes(4).toString("hex")}`, fixtureId = randomBytes(20).toString("hex");
    const fixture = { title: `Summary-only test fixture ${marker}`, tagline: `Test-only gallery card ${marker}`, url: `https://example.test/${marker}` };

    // Stub cards for whichever neighbours the real save finds, written just before the server asks.
    await page.route("**/api/evidence/**", async (route) => {
      const versionId = new URL(route.request().url()).pathname.split("/").pop()!;
      const rows = await sql`select unnest(neighbor_ids) as id from idea_versions where id = ${versionId}::uuid`;
      for (const { id } of rows) await writeFile(join(stub!, `evidence-${id}.json`), JSON.stringify({
        overlaps: [{ text: "Both are built for a team working together.", label: "inferred", sourceIds: [id] }], differences: [],
        uncertainty: { text: "Whether it was ever used at an event is unknown.", label: "unverified", sourceIds: [] } }));
      await route.continue();
    });

    let workspaceId: string | null = null;
    try {
      await page.goto("/");
      const ws = page.locator("[data-workspace-id]");
      await expect(ws).toBeAttached({ timeout: 30_000 });
      workspaceId = await ws.getAttribute("data-workspace-id");
      // A first save of the same idea finds its nearest project; the fixture copies that embedding, so it ties for first.
      const first = await page.request.post("/api/ideas", { headers: { origin: new URL(page.url()).origin, "Idempotency-Key": randomUUID() }, data: interpretation });
      expect(first.status(), await first.text()).toBe(201);
      const [nearest] = (await first.json()).neighborIds as string[];
      const inserted = await sql`insert into projects (id, url, title, tagline, description, technologies, events, date, date_kind, source, fetched_at, content_hash, embedding, x, y, z, corpus_version)
        select ${fixtureId}, ${fixture.url}, ${fixture.title}, ${fixture.tagline}, '', '[]'::jsonb, '[]'::jsonb, null, 'unknown', 'test-fixture', now(), md5(${marker}), embedding, x, y, z, corpus_version
        from projects where id = ${nearest} returning id`;
      expect(inserted).toHaveLength(1);

      if (name === "phone") await page.getByRole("navigation", { name: "Destinations" }).getByRole("link", { name: "Idea" }).click();
      await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals around dietary constraints.");
      await page.getByRole("button", { name: "Interpret" }).click();
      await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();

      const evidence = page.getByRole("region", { name: "Evidence" });
      const cards = evidence.getByRole("article");
      await expect(cards).toHaveCount(3, { timeout: 90_000 });
      const more = evidence.getByRole("button", { name: "Compare the remaining neighbors" });
      if (!(await evidence.locator(`[data-project-id="${fixtureId}"]`).count())) { await more.click(); await expect(cards).toHaveCount(5, { timeout: 90_000 }); }

      // The summary-only card's excerpt is headed as the gallery card; a full neighbour's isn't.
      const gallery = evidence.locator(`[data-project-id="${fixtureId}"]`);
      await gallery.getByText("Uncertainty and source excerpt").click();
      await expect(gallery.getByText(GALLERY_HEADING)).toBeVisible();
      await expect(gallery.locator("blockquote")).toHaveText(fixture.tagline);
      const fullIds = (await sql`select id from projects where id = any(${await cards.evaluateAll((els) => els.map((e) => e.getAttribute("data-project-id")!))}) and btrim(description) <> ''`).map((r) => String(r.id));
      expect(fullIds.length).toBeGreaterThan(0);
      const full = evidence.locator(`[data-project-id="${fullIds[0]}"]`);
      await full.getByText("Uncertainty and source excerpt").click();
      await expect(full.locator("blockquote")).toBeVisible();
      await expect(full.getByText(GALLERY_HEADING)).toHaveCount(0);
      await gallery.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath(`${name}-evidence.png`) });

      // Its title opens the drawer: the gallery-card line next to the Devpost link. A full project's drawer has no such line.
      const drawer = page.getByRole("region", { name: "Project" });
      await gallery.getByRole("button", { name: fixture.title }).click();
      await expect(drawer.getByRole("heading", { name: fixture.title })).toBeVisible();
      await expect(drawer.getByText(GALLERY_LINE)).toBeVisible();
      await expect(drawer.getByRole("link", { name: /^Source:/ })).toHaveAttribute("href", fixture.url);
      await page.screenshot({ path: info.outputPath(`${name}-drawer-gallery-card.png`) });
      await drawer.getByRole("button", { name: "Close" }).click();
      await expect(drawer).toHaveCount(0);
      await full.getByRole("button").first().click();
      await expect(drawer.getByRole("heading")).toBeVisible();
      await expect(drawer.getByText(GALLERY_LINE)).toHaveCount(0);
      await expect(drawer.getByText(/description unknown/)).toHaveCount(0);
      await page.screenshot({ path: info.outputPath(`${name}-drawer-full.png`) });
    } finally {
      if (workspaceId) await sql`delete from workspaces where id = ${workspaceId}::uuid`;
      await sql`delete from projects where id = ${fixtureId}`;
    }
  });
}
