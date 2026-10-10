import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, relative, resolve } from "node:path";

test("production build stays inside the app and emits its standalone runtime", async ({ request }, info) => {
  const app = process.cwd();
  const manifest = JSON.parse(await readFile(join(app, ".next/required-server-files.json"), "utf8"));
  expect(resolve(manifest.config.outputFileTracingRoot)).toBe(resolve(app));
  expect(manifest.config.output).toBe("standalone");
  const standalone = join(app, ".next/standalone");
  const server = join(standalone, "server.js");
  expect((await readFile(server, "utf8")).length).toBeGreaterThan(0);
  const runtime = createRequire(server).resolve("next/package.json");
  expect(relative(standalone, runtime).startsWith("..")).toBe(false);
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const health = await response.json();
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true }).trim();
  expect(health.commit).toBe(commit);
  await writeFile(info.outputPath("build-root.json"), JSON.stringify({ commit, tracingRoot: manifest.config.outputFileTracingRoot, standaloneRuntime: relative(standalone, runtime), health }, null, 2));
});
