import { z } from "zod";

export const claim = z.object({ text: z.string().trim().min(1), label: z.enum(["supported", "inferred", "unverified"]), sourceIds: z.array(z.string().min(1)) }).strict();
export function checkClaims(value: unknown, allowed: readonly string[], excerpts?: ReadonlyMap<string, string>): void {
  if (!value || typeof value !== "object") return;
  if (!Array.isArray(value) && ("label" in value || "sourceIds" in value)) {
    const parsed = claim.parse(value);
    if (parsed.sourceIds.some((id) => !allowed.includes(id))) throw new Error("Claim cites a source outside the supplied scope");
    if (parsed.label === "supported") {
      if (!parsed.sourceIds.length) throw new Error("Supported claim has no citation");
      if (excerpts && parsed.sourceIds.some((id) => !excerpts.get(id)?.includes(parsed.text))) throw new Error("Supported claim is not a stored source quote");
    }
    return;
  }
  Object.values(value).forEach((child) => checkClaims(child, allowed, excerpts));
}
export function configuredProviders(env: NodeJS.ProcessEnv): ("claude" | "gemini")[] {
  if (env.AI_STUB_ALLOW !== undefined || env.AI_STUB_DIR !== undefined) throw new Error("Live smoke refuses AI_STUB_ALLOW or AI_STUB_DIR, including empty values");
  if (!env.TEST_DATABASE_URL || env.DATABASE_URL !== env.TEST_DATABASE_URL) throw new Error("Live smoke requires DATABASE_URL to equal the dedicated TEST_DATABASE_URL");
  const providers: ("claude" | "gemini")[] = [];
  if (env.ANTHROPIC_API_KEY?.trim()) providers.push("claude");
  if (env.GEMINI_API_KEY?.trim()) providers.push("gemini");
  if (!providers.length) throw new Error("Live smoke requires a configured live provider");
  return providers;
}
export function providerEnvironment(env: NodeJS.ProcessEnv, provider: "claude" | "gemini", token: string): NodeJS.ProcessEnv {
  return { ...env, NODE_ENV: "production", AI_PROVIDER: provider, UNCHARTED_VERIFY_TOKEN: token,
    // Explicit empty overrides prevent Next dotenv from restoring the other provider or fixtures.
    ANTHROPIC_API_KEY: provider === "claude" ? env.ANTHROPIC_API_KEY : "",
    GEMINI_API_KEY: provider === "gemini" ? env.GEMINI_API_KEY : "", AI_STUB_ALLOW: "", AI_STUB_DIR: "" };
}
