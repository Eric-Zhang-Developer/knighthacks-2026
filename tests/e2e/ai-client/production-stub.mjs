import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm, realpath } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const next = join(root, "node_modules/next/dist/bin/next");
const expected = { message: "Production fixture verified" };

function environment() {
  const env = { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" };
  for (const key of Object.keys(env)) {
    if (/^(ANTHROPIC|GEMINI|GOOGLE|AI_STUB|VERCEL)/.test(key)) delete env[key];
  }
  return env;
}
function launch(args, cwd, env) {
  const child = spawn(process.execPath, [next, ...args], { cwd, env, windowsHide: true, stdio: "ignore" });
  const done = new Promise((resolveDone, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolveDone(code));
  });
  return { child, done };
}
async function stop(process) {
  if (process.child.exitCode === null) process.child.kill();
  await process.done;
}
async function unusedPort() {
  const server = createServer();
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}
async function observe(app, env) {
  const port = await unusedPort();
  const server = launch(["start", "--hostname", "127.0.0.1", "--port", String(port)], app, env);
  try {
    const url = `http://127.0.0.1:${port}/api/probe`;
    const readyBy = Date.now() + 30000;
    while (Date.now() < readyBy) {
      if (server.child.exitCode !== null) throw new Error("Production fixture server exited before readiness");
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
        const body = await response.json();
        // Only retain known fixture fields and safe typed codes, never raw responses.
        return { status: response.status, production: body.production === true,
          fixtureMatches: JSON.stringify(body.data) === JSON.stringify(expected),
          unavailable: body.code === "STUB_UNAVAILABLE" };
      } catch { await new Promise((done) => setTimeout(done, 200)); }
    }
    throw new Error("Production fixture server did not become ready");
  } finally { await stop(server); }
}

export async function productionStubCheck() {
  const app = await mkdtemp(join(here, "production-stub-temp-"));
  try {
    await mkdir(join(app, "app/api/probe"), { recursive: true });
    await mkdir(join(app, "fixtures"));
    await writeFile(join(app, "fixtures/probe.json"), JSON.stringify(expected));
    await writeFile(join(app, "package.json"), JSON.stringify({ private: true }));
    await writeFile(join(app, "next.config.mjs"), `export default { outputFileTracingRoot: ${JSON.stringify(root)} };\n`);
    const modulePath = relative(join(app, "app/api/probe"), join(root, "lib/ai/generate.ts")).split(sep).join("/");
    await writeFile(join(app, "app/api/probe/route.js"), `import { generate, AiError } from ${JSON.stringify(modulePath)};
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET() {
  const production = process.env.NODE_ENV === "production";
  try {
    const data = await generate({ prompt: { text: "Fixture probe", stubKey: "probe" }, schema: z.object({ message: z.string() }) });
    return Response.json({ production, data });
  } catch (error) {
    return Response.json({ production, code: error instanceof AiError ? error.code : "UNEXPECTED" }, { status: 503 });
  }
}\n`);
    const env = environment();
    const build = launch(["build", "--no-lint"], app, env);
    const timer = setTimeout(() => build.child.kill(), 180000);
    let code;
    try { code = await build.done; } finally { clearTimeout(timer); }
    if (code !== 0) throw new Error("Production fixture Next build failed or timed out");
    const fixtureEnv = { ...env, AI_STUB_DIR: join(app, "fixtures") };
    const results = {
      allowed: await observe(app, { ...fixtureEnv, AI_STUB_ALLOW: "1" }),
      unapproved: await observe(app, fixtureEnv),
      deployed: await observe(app, { ...fixtureEnv, AI_STUB_ALLOW: "1", VERCEL: "1" }),
    };
    return results;
  } finally {
    // Delete only the exact fresh directory, after checking its resolved parent and prefix.
    const actual = await realpath(app);
    if (dirname(actual).toLowerCase() !== (await realpath(here)).toLowerCase() || !actual.split(sep).at(-1).startsWith("production-stub-temp-")) {
      throw new Error("Refusing fixture cleanup outside the owned test directory");
    }
    await rm(actual, { recursive: true, force: true });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const results = await productionStubCheck();
  process.stdout.write(`${JSON.stringify(results)}\n`);
  if (!(results.allowed.production && results.allowed.status === 200 && results.allowed.fixtureMatches &&
    results.unapproved.production && results.unapproved.status === 503 && results.unapproved.unavailable &&
    results.deployed.production && results.deployed.status === 503 && results.deployed.unavailable)) process.exitCode = 1;
}
