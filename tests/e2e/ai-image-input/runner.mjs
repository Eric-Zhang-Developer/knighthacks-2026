// Isolated verifier process: runs the owned lib/ai/generate.ts and lib/ai/image.ts (compiled with the pinned
// TypeScript; only Next's server marker is replaced) on a synthetic brief image. Live mode tries each configured
// provider alone, the other's key removed, so a fallback can't hide one that can't read images.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const require = createRequire(import.meta.url);
const modules = {};
const load = (name) => {
  if (modules[name]) return modules[name].exports;
  const mod = (modules[name] = { exports: {} });
  const source = readFileSync(fileURLToPath(new URL(`../../../lib/ai/${name}.ts`, import.meta.url)), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const req = (id) => (id === "next/dist/compiled/server-only" ? {} : id.startsWith("./") ? load(id.slice(2)) : require(id));
  new Function("require", "module", "exports", js)(req, mod, mod.exports);
  return mod.exports;
};
const { transcribeImage } = load("image");
const { AiError } = load("generate");
const image = { mediaType: "image/png", data: new Uint8Array(readFileSync(fileURLToPath(new URL("fixtures/brief.png", import.meta.url)))) };
const providers = [["anthropic", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"], ["gemini", "GEMINI_API_KEY", "GEMINI_MODEL"]]
  .filter(([, key, model]) => process.env[key]?.trim() && process.env[model]?.trim());
process.env.NODE_ENV = "test";
const summary = (t) => ({ legibility: t.legibility, transcriptChars: t.transcript.length, uncertain: t.uncertain.length, transcript: t.transcript });
const results = [];
if (!providers.length) {
  process.env.AI_STUB_DIR = fileURLToPath(new URL("fixtures", import.meta.url));
  const t0 = Date.now();
  results.push({ provider: "fixture", model: null, ms: Date.now() - t0, ...summary(await transcribeImage(image, "brief")) });
} else {
  delete process.env.AI_STUB_DIR;
  const saved = { ...process.env };
  for (const [name, , model] of providers) {
    for (const [other, key] of providers) if (other !== name) delete process.env[key];
    if (name === "anthropic") delete process.env.GEMINI_API_KEY_SPARE;
    process.env.AI_PROVIDER = name;
    const t0 = Date.now();
    try { results.push({ provider: name, model: process.env[model], ms: Date.now() - t0, ...summary(await transcribeImage(image)) }); }
    catch (error) { results.push({ provider: name, model: process.env[model], ms: Date.now() - t0, code: error instanceof AiError ? error.code : "VERIFIER_FAILURE" }); }
    for (const r of results.slice(-1)) r.ms = Date.now() - t0;
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
}
process.stdout.write(JSON.stringify({ mode: providers.length ? "live" : "stub", results }));
