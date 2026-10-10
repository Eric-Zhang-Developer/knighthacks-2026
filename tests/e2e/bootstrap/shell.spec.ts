import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test("health reports the built commit", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect((await res.json()).commit).toBe(execSync("git rev-parse HEAD").toString().trim());
});

test("home renders the layout and says the corpus isn't loaded", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && !m.text().includes("stars.json") && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  for (const name of ["Search", "Galaxy", "Idea and evidence", "Voice"]) {
    await expect(page.getByLabel(name, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("status")).toHaveText(/Corpus not loaded|projects indexed/);
  expect(errors).toEqual([]);
});
