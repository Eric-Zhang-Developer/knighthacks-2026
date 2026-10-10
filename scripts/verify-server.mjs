import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Probe exactly the loopback interface used by Next. Readiness identity guards
 * the unavoidable gap between releasing this socket and the app binding it. */
export async function prepareIdentity(requested = process.env.UNCHARTED_VERIFY_PORT) {
  if (requested !== undefined && (!/^[1-9][0-9]{0,4}$/.test(requested) || Number(requested) > 65535)) {
    throw new Error("UNCHARTED_VERIFY_PORT must be an integer from 1 to 65535");
  }
  const server = createServer();
  try {
    await new Promise((done, reject) => { server.once("error", reject); server.listen(requested === undefined ? 0 : Number(requested), "127.0.0.1", done); });
    const port = server.address().port;
    await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
    return { port, token: randomBytes(24).toString("hex") };
  } catch {
    throw new Error(requested === undefined ? "Could not allocate a verifier loopback port" : `Requested verifier port ${requested} is unavailable`);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(JSON.stringify(await prepareIdentity())); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
