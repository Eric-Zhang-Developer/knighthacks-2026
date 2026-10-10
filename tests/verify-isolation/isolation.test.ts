import { afterEach, expect, test, vi } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { join } from "node:path";
import { GET } from "@/app/api/health/verify/[token]/route";
const run = promisify(execFile);
const helper = join(process.cwd(), "scripts/verify-server.mjs");
afterEach(() => vi.unstubAllEnvs());

test("actual verifier concurrent launch regression runs in the canonical unit suite", async () => {
  const { stdout } = await run(process.execPath, ["--test", "tests/verify-isolation/launch.test.mjs"], { windowsHide: true });
  expect(stdout).toContain("# fail 0");
});
test.each(["", "0", "65536", "no", "1e3", "-1"])("invalid requested port %s fails before launch", async (port) => {
  await expect(run(process.execPath, [helper], { env: { ...process.env, UNCHARTED_VERIFY_PORT: port }, windowsHide: true })).rejects.toMatchObject({ code: 1 });
});
test("occupied explicit port is refused and its listener remains alive", async () => {
  const server = createServer((_req, res) => { res.writeHead(200); res.end("existing listener"); });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing listener address");
    await expect(run(process.execPath, [helper], { env: { ...process.env, UNCHARTED_VERIFY_PORT: String(address.port) }, windowsHide: true })).rejects.toMatchObject({ code: 1 });
    expect(await (await fetch(`http://127.0.0.1:${address.port}`)).text()).toBe("existing listener");
  } finally { await new Promise<void>((done) => server.close(() => done())); }
});
test("another run's HTTP listener rejects readiness and exact identity succeeds", async () => {
  vi.stubEnv("UNCHARTED_VERIFY_TOKEN", "a".repeat(48));
  const server = createServer(async (req, res) => {
    const token = req.url?.split("/").at(-1) ?? "";
    const result = await GET(new Request("http://127.0.0.1"), { params: Promise.resolve({ token }) });
    res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(await result.text());
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing listener address");
    const base = `http://127.0.0.1:${address.port}/api/health/verify/`;
    expect((await fetch(base + "b".repeat(48))).status).toBe(404);
    const matching = await fetch(base + "a".repeat(48));
    expect(matching.status).toBe(200); expect(await matching.json()).toEqual({ ready: true });
    expect(matching.headers.get("cache-control")).toBe("no-store");
  } finally { await new Promise<void>((done) => server.close(() => done())); }
});
test("readiness is unavailable without a configured run identity", async () => {
  vi.stubEnv("UNCHARTED_VERIFY_TOKEN", "");
  expect((await GET(new Request("http://127.0.0.1"), { params: Promise.resolve({ token: "a".repeat(48) }) })).status).toBe(404);
});
