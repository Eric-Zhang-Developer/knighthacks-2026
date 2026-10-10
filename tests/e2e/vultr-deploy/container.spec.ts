import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

// The standard verifier starts Next on the host; acceptance here targets the separate Docker container.
// No database credentials are needed for its health/home endpoints.
test("standalone container serves its built commit as an unprivileged user", async ({}, info) => {
  test.setTimeout(480_000);
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const image = `uncharted-vultr-check:${commit.slice(0, 12)}`;
  const docker = (args: string[], timeout = 30_000) => execFileSync("docker", args,
    { encoding: "utf8", timeout, maxBuffer: 16 * 1024 * 1024 }).trim();
  let container: string | undefined;
  try {
    docker(["build", "--build-arg", `GIT_COMMIT=${commit}`, "--tag", image, "."], 400_000);
    expect(docker(["image", "inspect", "--format", "{{.Config.User}}", image])).toBe("node");
    container = docker(["run", "--detach", "--rm", "--publish", "127.0.0.1::3000", image]);
    const address = docker(["port", container, "3000/tcp"]);
    expect(address).toMatch(/^127\.0\.0\.1:\d+$/);
    const origin = `http://${address}`;
    await expect.poll(async () => {
      try { return await (await fetch(`${origin}/api/health`)).json(); } catch { return null; }
    }, { timeout: 30_000 }).toEqual({ commit });
    expect((await fetch(origin)).status).toBe(200);
    const missingSecrets = docker(["exec", container, "node", "-e",
      "for (const p of ['.env','.env.local','.git','corpus/data']) if(require('node:fs').existsSync(p)) process.exit(1)"]);
    expect(missingSecrets).toBe("");
    await writeFile(info.outputPath("container.json"), JSON.stringify({ commit, image, user: "node", health: "pass", home: "pass" }, null, 2));
  } finally {
    if (container) docker(["stop", container]);
  }
});
