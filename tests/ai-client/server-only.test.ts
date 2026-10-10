import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
const require = createRequire(import.meta.url);
test("installed Next compiler maps the imported marker to a client-build error", () => {
  const { createServerOnlyClientOnlyAliases } = require("next/dist/build/create-compiler-aliases");
  const marker = "next/dist/compiled/server-only";
  expect(createServerOnlyClientOnlyAliases(false)[marker]).toBe(`${marker}/index`);
  expect(createServerOnlyClientOnlyAliases(true)[`${marker}$`]).toBe(`${marker}/empty`);
  expect(readFileSync(require.resolve(`${marker}/index`), "utf8")).toContain("cannot be imported from a Client Component");
  for (const file of ["lib/ai/generate.ts", "lib/ai/claims.ts"]) expect(readFileSync(file, "utf8")).toContain(`import "${marker}"`);
});
