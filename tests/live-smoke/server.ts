import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { providerEnvironment } from "./contracts";

export async function startServer(provider: "claude" | "gemini") {
  const allocationEnv = { ...process.env };
  delete allocationEnv.UNCHARTED_VERIFY_PORT;
  const identity = JSON.parse(execFileSync(process.execPath, [join(process.cwd(), "scripts/verify-server.mjs")], {
    encoding: "utf8", windowsHide: true, env: allocationEnv,
  }).trim()) as { port: number; token: string };
  // NextRequest canonicalizes loopback IPs to localhost for same-origin checks.
  const origin = `http://localhost:${identity.port}`;
  const child = spawn(process.execPath, [join(process.cwd(), "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(identity.port)], {
    cwd: process.cwd(), env: providerEnvironment(process.env, provider, identity.token), windowsHide: true, stdio: "ignore",
  });
  let failed = false;
  child.on("error", () => { failed = true; });
  const stop = () => stopServer(child);
  try {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline && !failed && child.exitCode === null) {
      try {
        const response = await fetch(`${origin}/api/health/verify/${identity.token}`, { signal: AbortSignal.timeout(1000) });
        if (response.status === 200 && (await response.json()).ready === true) return { origin, stop };
      } catch { /* This owned server may still be starting. */ }
      await delay(200);
    }
    throw new Error(`Live-smoke ${provider} server did not become ready`);
  } catch (error) { await stop(); throw error; }
}


export async function stopServer(child: ChildProcess) {
  const stopped = () => child.exitCode !== null || child.signalCode !== null;
  if (stopped() || !child.pid) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill();
  await Promise.race([exited, delay(5000, undefined, { ref: false })]);
  if (!stopped()) { child.kill("SIGKILL"); await Promise.race([exited, delay(2000, undefined, { ref: false })]); }
  if (!stopped()) throw new Error("Owned live-smoke server did not stop");
}
