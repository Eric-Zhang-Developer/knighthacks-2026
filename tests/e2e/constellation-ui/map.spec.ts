import { neon } from "@neondatabase/serverless";
import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// Real save and drawer on the Neon test branch. The assumptions route is stubbed with fixture assumptions citing real
// project ids, and the evidence route with those projects' titles; interpretation reads AI_STUB_DIR (a fresh absolute
// directory). The map makes no model call. Traces would hold the session cookie.
test.use({ trace: "off" });
const interpretation = { title: "Team meal planner", description: "Help hackathon teams plan shared meals.", audience: "Hackathon teammates",
  problem: "Coordinating meals while building together", workflow: "Collect dietary constraints, then choose a meal", constraints: null };
const map = (page: Page) => page.getByRole("region", { name: "Challenge" }).getByRole("region", { name: "Assumption map" });

for (const viewport of [{ name: "desktop", width: 1280, height: 900 }, { name: "phone", width: 390, height: 844 }]) {
  test(`assumptions as a map: one edge per shared source, keyboard selection, drawer (${viewport.name})`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    const stub = process.env.AI_STUB_DIR;
    expect(Boolean(stub) && isAbsolute(stub!), "Start the server with a fresh absolute AI_STUB_DIR").toBe(true);
    expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must both use the test branch").toBe(true);
    await writeFile(join(stub!, "idea-interpret.json"), JSON.stringify(interpretation));
    const sql = neon(process.env.TEST_DATABASE_URL!);
    const [p1, p2] = (await sql`select id, title from projects order by id limit 2`) as { id: string; title: string }[];
    const item = (kind: string, text: string, sourceIds: string[], insufficient = false) => ({ kind, insufficient,
      assumption: { text, label: sourceIds.length ? "inferred" : "unverified", sourceIds },
      reversal: insufficient ? null : { observe: `Ask five teams about: ${text}`, reversesIf: "Most say it never happens" } });
    const assumptions = [
      item("need", "Teams lose real building time choosing meals", [p1.id]),
      item("data", "Teams will share their dietary limits", [p1.id], true),
      item("feasibility", "Menus can be filtered by allergen", []),
      item("differentiation", "No existing tool decides for a whole team", [p2.id]),
    ];
    await page.route("**/api/assumptions/**", (r) => r.fulfill({ json: { versionId: "stub", assumptions } }));
    await page.route("**/api/evidence/**", (r) => r.fulfill({ json: { cards: [p1, p2].map((p) => ({ projectId: p.id, title: p.title, url: `https://devpost.com/software/${p.id}`,
      excerpt: p.title, overlaps: [], differences: [], uncertainty: { text: "Unknown", label: "unverified", sourceIds: [] } })) } }));

    await page.goto("/");
    await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
    await page.getByRole("button", { name: "Interpret" }).click();
    await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();

    // 1. One node per assumption, each in its kind's cluster; exactly one edge (need and data share p1).
    const nodes = map(page).getByRole("button", { name: /./ }).and(map(page).locator("[data-kind]"));
    await expect(nodes).toHaveCount(4, { timeout: 60_000 });
    await expect(map(page).locator("line[data-edge]")).toHaveCount(1);
    await expect(map(page).locator("line[data-edge]")).toHaveAttribute("data-edge", "0-1");
    for (const a of assumptions) {
      const node = await map(page).getByRole("button", { name: a.assumption.text }).boundingBox();
      const label = await map(page).locator(`[data-cluster="${a.kind}"]`).boundingBox();
      const near = Math.hypot(node!.x + node!.width / 2 - (label!.x + label!.width / 2), node!.y - label!.y);
      for (const other of assumptions.filter((o) => o.kind !== a.kind)) {
        const o = await map(page).locator(`[data-cluster="${other.kind}"]`).boundingBox();
        expect(near, `${a.kind} node is nearest its own cluster label`).toBeLessThan(Math.hypot(node!.x + node!.width / 2 - (o!.x + o!.width / 2), node!.y - o!.y));
      }
    }
    await map(page).scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath(`map-${viewport.name}.png`) });

    // 2. Keyboard: focus the first node and press Enter -> its claim, label, cited project and test.
    const first = map(page).getByRole("button", { name: assumptions[0].assumption.text });
    await first.focus();
    await page.keyboard.press("Enter");
    const detail = map(page).getByRole("group", { name: "Selected assumption" });
    await expect(detail).toContainText(assumptions[0].assumption.text);
    await expect(detail.locator('[data-label="inferred"]')).toHaveText(/inferred/);
    await expect(detail).toContainText(`Check: Ask five teams about: ${assumptions[0].assumption.text}`);
    await expect(detail).toContainText("Changes my mind if: Most say it never happens");
    // The insufficient one says so.
    await map(page).getByRole("button", { name: assumptions[1].assumption.text }).click();
    await expect(detail).toContainText("Evidence is insufficient");
    // A cited project opens the drawer on it.
    await detail.getByRole("button", { name: p1.title }).click();
    await expect(page.getByRole("region", { name: "Project" }).getByRole("heading", { name: p1.title })).toBeVisible({ timeout: 30_000 });
    await map(page).scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath(`selected-${viewport.name}.png`) });
  });
}

test("no assumptions yet: an empty state pointing at What would change your mind?", async ({ page }) => {
  test.setTimeout(120_000);
  await writeFile(join(process.env.AI_STUB_DIR!, "idea-interpret.json"), JSON.stringify(interpretation));
  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("button", { name: "Interpret" }).click();
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();
  await expect(map(page).getByRole("status")).toContainText('Use "What would change your mind?"', { timeout: 60_000 });
});
