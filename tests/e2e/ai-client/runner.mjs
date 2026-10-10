// Isolated verifier process: execute the actual owned TypeScript using the pinned
// compiler. Only Next's build-time server marker is replaced outside Next.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { z } from "zod";
const require = createRequire(import.meta.url);
const source = fileURLToPath(new URL("../../../lib/ai/generate.ts", import.meta.url));
const compiled = ts.transpileModule(readFileSync(source, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const ownedModule = { exports: {} };
const serverRequire = (name) => name === "next/dist/compiled/server-only" ? {} : require(name);
new Function("require", "module", "exports", compiled)(serverRequire, ownedModule, ownedModule.exports);
const live = Boolean(process.env.GEMINI_API_KEY?.trim());
// Stub mode is explicitly confined to this test process, never the app server.
process.env.NODE_ENV = "test";
if (live) delete process.env.AI_STUB_DIR;
else process.env.AI_STUB_DIR = fileURLToPath(new URL("../../ai-client/fixtures", import.meta.url));
try {
  const data = await ownedModule.exports.generate({
    prompt: { text: 'Return a JSON object with a message string saying "AI client verified".', stubKey: "smoke" },
    schema: z.object({ message: z.string().min(1).max(200) }),
  });
  process.stdout.write(JSON.stringify({ mode: live ? "live" : "stub", model: live ? process.env.GEMINI_MODEL : null, data }));
} catch (error) {
  process.stderr.write(JSON.stringify({ code: error instanceof ownedModule.exports.AiError ? error.code : "VERIFIER_FAILURE" }));
  process.exitCode = 1;
}
