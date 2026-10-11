import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// The saved-idea restore on first load must not clear a project picked while the list was loading (seen as a flaky
// search e2e: the pick landed ~0.3 s before /api/ideas answered, and the restore deselected it). /api/ideas is held
// back on purpose so the pick always comes first. Fixtures: UI behaviour only.
const record = JSON.parse(readFileSync("corpus/fixtures/sample.jsonl", "utf8").split("\n")[0]) as { id: string; title: string };
const saved = { ideaId: "00000000-0000-4000-8000-000000000001", versionId: "00000000-0000-4000-8000-000000000011", title: "Study planner", description: "Study schedule", problem: null, audience: null, workflow: null, constraints: null, parentId: null, x: 0, y: 0, z: 0, neighborIds: [], corpusVersion: "fixture", createdAt: "2026-10-11T00:00:00Z" };

for (const [name, ideas] of [["no saved ideas", []], ["one saved idea", [saved]]] as const) {
  test(`a search pick made before the saved ideas load survives the restore (${name})`, async ({ page }) => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route("**/api/workspace", (route) => route.fulfill({ json: { workspaceId: "fixture-workspace", memberId: "fixture-member" } }));
    await page.route("**/api/ideas", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await held;
      await route.fulfill({ json: ideas });
    });
    await page.route("**/api/search?*", (route) =>
      route.fulfill({ json: { results: [{ ...record, tagline: null, event: null, year: null, similarity: 0.9 }], textMatches: [], meaning: "ok" } }),
    );
    const listed = page.waitForResponse("**/api/ideas");
    await page.goto("/");
    const box = page.getByRole("searchbox", { name: "Search projects" });
    await box.fill("anything");
    await page.getByRole("list", { name: "Similar projects" }).getByRole("button").first().click();
    release();
    await listed;
    await page.waitForTimeout(500); // let the restore apply
    await box.click(); // the results panel folds on a pick; the box brings it back
    await expect(page.getByRole("list", { name: "Similar projects" }).getByRole("button").first()).toHaveAttribute("aria-current", "true");
  });
}
