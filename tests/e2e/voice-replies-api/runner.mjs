// Isolated actual-route verification. Only the provider SDK is substituted;
// these byte fixtures are not live or playable speech and are never saved.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const source = fileURLToPath(new URL("../../../app/api/speech/route.ts", import.meta.url));
const compiled = ts.transpileModule(readFileSync(source, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const sentinel = "isolated-speech-sdk-test-key";
process.env.ELEVENLABS_API_KEY = sentinel;
let scenario = "success";
const sdk = { ElevenLabsClient: class {
  textToSpeech = { stream: async () => {
    if (scenario === "down") throw new Error(sentinel);
    return new ReadableStream({ start(c) { c.enqueue(new Uint8Array([73, 68, 51, 1, 2])); c.close(); } });
  } };
} };
const owned = { exports: {} };
new Function("require", "module", "exports", compiled)((name) => name === "@elevenlabs/elevenlabs-js" ? sdk : require(name), owned, owned.exports);
const results = [];
for (scenario of ["success", "down"]) {
  const response = await owned.exports.POST(new Request("https://speech.test/api/speech", { method: "POST", headers: { origin: "https://speech.test", "content-type": "application/json" }, body: JSON.stringify({ text: "Hello" }) }));
  const bytes = Buffer.from(await response.arrayBuffer());
  assert(!bytes.toString("utf8").includes(sentinel));
  assert(!JSON.stringify([...response.headers]).includes(sentinel));
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.status, scenario === "success" ? 200 : 503);
  if (scenario === "success") { assert.equal(response.headers.get("content-type"), "audio/mpeg"); assert.equal(bytes.length, 5); }
  else assert.equal(typeof JSON.parse(bytes.toString()).error, "string");
  results.push({ scenario, status: response.status, headers: Object.fromEntries(response.headers), byteCount: bytes.length });
}
process.stdout.write(JSON.stringify({ mode: "isolated SDK mock; not live speech", results }));
