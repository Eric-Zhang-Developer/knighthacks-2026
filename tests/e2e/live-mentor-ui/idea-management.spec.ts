import { expect, test } from "@playwright/test";

// Auth/list fixtures test UI behavior only; they are not real persistence/audio receipts.
for (const width of [390, 1440]) {
  test(`compact saved-idea selection, add and safe deletion review at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const a = { ideaId: "00000000-0000-4000-8000-000000000001", versionId: "00000000-0000-4000-8000-000000000011", title: "Study planner", description: "Study schedule", problem: null, audience: null, workflow: null, constraints: null, parentId: null, x: 0, y: 0, z: 0, neighborIds: [], corpusVersion: "fixture", createdAt: "2026-10-11T00:00:00Z" };
    const b = { ...a, ideaId: "00000000-0000-4000-8000-000000000002", versionId: "00000000-0000-4000-8000-000000000012", title: "Quiet campus", createdAt: "2026-10-11T01:00:00Z" };
    let deletes = 0;
    await page.route("**/api/workspace", (route) => route.fulfill({ json: { workspaceId: "fixture-workspace", memberId: "fixture-member" } }));
    await page.route("**/api/ideas", (route) => route.fulfill({ json: [b, a] }));
    await page.route("**/api/ideas/*", (route) => { if (route.request().method() === "DELETE") deletes++; return route.fulfill({ status: 503, json: { error: "Unavailable" } }); });
    await page.goto("/#idea");
    const picker = page.getByRole("combobox", { name: "Select saved idea" });
    await expect(picker).toHaveValue(b.ideaId);
    await picker.selectOption(a.ideaId);
    await expect(page.getByRole("region", { name: "Your idea" })).toHaveAttribute("data-version-id", a.versionId);
    await page.getByText("Manage this idea", { exact: true }).click();
    await page.getByRole("button", { name: "Delete this idea…", exact: true }).click();
    const confirm = page.getByRole("region", { name: "Confirm idea deletion" });
    await expect(confirm.getByRole("heading")).toHaveText("Delete “Study planner”?");
    await expect(confirm.getByRole("button", { name: "Delete idea and all versions" })).toBeEnabled();
    await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(deletes).toBe(0);
    await page.getByRole("button", { name: "+ Add idea", exact: true }).click();
    await expect(page.getByRole("region", { name: "Saved ideas", exact: true }).getByRole("status")).toHaveText("Starting another idea. Your saved ideas are kept; nothing new has been saved.");
    await expect(picker).toHaveValue("");
    await expect(page.getByRole("heading", { name: "Start with a conversation" })).toBeVisible();
    await picker.selectOption(b.ideaId);
    await expect(page.getByRole("region", { name: "Your idea" })).toHaveAttribute("data-version-id", b.versionId);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.reload();
    await expect(picker).toHaveValue(b.ideaId);
  });
}

test("a late initial list cannot leave the new draft and restore an old selection", async ({ page }) => {
  await page.route("**/api/workspace", (route) => route.fulfill({ json: { workspaceId: "fixture-workspace", memberId: "fixture-member" } }));
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/ideas", async (route) => {
    await held;
    await route.fulfill({ json: [{ ideaId: "00000000-0000-4000-8000-000000000001", versionId: "00000000-0000-4000-8000-000000000011", title: "Old idea", neighborIds: [], x: 0, y: 0, z: 0, createdAt: "2026-10-11T00:00:00Z" }] });
  });
  await page.goto("/#idea");
  await page.getByRole("button", { name: "+ Add idea", exact: true }).click();
  release();
  await expect(page.getByRole("combobox", { name: "Select saved idea" })).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Select saved idea" })).toHaveValue("");
  await expect(page.getByRole("heading", { name: "Start with a conversation" })).toBeVisible();
});

test("deletion failure keeps the idea; successful selected and last deletes follow exact receipts", async ({ page }) => {
  const a = { ideaId: "00000000-0000-4000-8000-000000000001", versionId: "00000000-0000-4000-8000-000000000011", title: "Study planner", description: null, problem: null, audience: null, workflow: null, constraints: null, parentId: null, x: 0, y: 0, z: 0, neighborIds: [], corpusVersion: "fixture", createdAt: "2026-10-11T01:00:00Z" };
  const b = { ...a, ideaId: "00000000-0000-4000-8000-000000000002", versionId: "00000000-0000-4000-8000-000000000012", title: "Quiet campus", createdAt: "2026-10-11T00:00:00Z" };
  let ideas = [a, b];
  let fail = true;
  await page.route("**/api/workspace", (route) => route.fulfill({ json: { workspaceId: "fixture-workspace", memberId: "fixture-member" } }));
  await page.route("**/api/ideas", (route) => route.fulfill({ json: ideas }));
  await page.route("**/api/ideas/*", (route) => {
    if (route.request().method() !== "DELETE") return route.fulfill({ status: 404, json: {} });
    if (fail) return route.fulfill({ status: 503, json: { error: "Unavailable" } });
    const ideaId = new URL(route.request().url()).pathname.split("/").pop();
    ideas = ideas.filter((idea) => idea.ideaId !== ideaId);
    return route.fulfill({ json: { ideaId, deleted: true } });
  });
  await page.goto("/#idea");
  const picker = page.getByRole("combobox", { name: "Select saved idea" });
  await expect(picker).toHaveValue(a.ideaId);
  await page.getByText("Manage this idea", { exact: true }).click();
  await page.getByRole("button", { name: "Delete this idea…", exact: true }).click();
  await page.getByRole("button", { name: "Delete idea and all versions", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Deletion was not confirmed" })).toBeVisible();
  await expect(picker).toHaveValue(a.ideaId);
  fail = false;
  await page.getByRole("button", { name: "Delete idea and all versions", exact: true }).click();
  await expect(picker).toHaveValue(b.ideaId);
  await page.getByRole("button", { name: "Delete this idea…", exact: true }).click();
  await page.getByRole("button", { name: "Delete idea and all versions", exact: true }).click();
  await expect(picker).toHaveValue("");
  await expect(page.getByRole("heading", { name: "Start with a conversation" })).toBeVisible();
  await page.reload();
  await expect(picker).toBeEnabled();
  await expect(picker).toHaveValue("");
});
