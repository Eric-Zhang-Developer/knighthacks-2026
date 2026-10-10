import { describe, expect, it } from "vitest";
import { checkClaims, configuredProviders, providerEnvironment } from "./contracts";
const env: NodeJS.ProcessEnv = { NODE_ENV: "test", DATABASE_URL: "test-database", TEST_DATABASE_URL: "test-database", GEMINI_API_KEY: "unit-gemini", ANTHROPIC_API_KEY: "unit-claude" };
describe("live-only boundaries", () => {
  it.each(["AI_STUB_ALLOW", "AI_STUB_DIR"])("refuses %s even when empty", (key) => {
    for (const value of ["", "1", "/fixtures"]) expect(() => configuredProviders({ ...env, [key]: value })).toThrow("refuses");
  });
  it("requires a test database match without exposing URLs", () => {
    expect(() => configuredProviders({ ...env, DATABASE_URL: "other" })).toThrow("dedicated TEST_DATABASE_URL");
    expect(() => configuredProviders({ ...env, TEST_DATABASE_URL: undefined })).toThrow("dedicated TEST_DATABASE_URL");
  });
  it("attempts each keyed provider even if its model configuration is absent", () => expect(configuredProviders(env)).toEqual(["claude", "gemini"]));
  it("fails when neither provider is configured", () => expect(() => configuredProviders({ NODE_ENV: "test", DATABASE_URL: "test", TEST_DATABASE_URL: "test" })).toThrow("configured live provider"));
  it.each(["claude", "gemini"] as const)("isolates %s without dotenv restoring the other provider", (provider) => {
    const isolated = providerEnvironment(env, provider, "test-token");
    expect(isolated.AI_PROVIDER).toBe(provider);
    expect(isolated[provider === "claude" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY"]).toBe("");
    expect(isolated[provider === "claude" ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY"]).toBeTruthy();
    expect(isolated.NODE_ENV).toBe("production"); expect(isolated.UNCHARTED_VERIFY_TOKEN).toBe("test-token");
    expect(isolated.AI_STUB_ALLOW).toBe(""); expect(isolated.AI_STUB_DIR).toBe("");
  });
});
describe("claim assertions", () => {
  const supported = { text: "A source quote", label: "supported", sourceIds: ["source"] };
  it("accepts nested real source claims and explicit unverified tests", () => {
    expect(() => checkClaims({ cards: [supported, { text: "Proposed test: ask a teammate", label: "unverified", sourceIds: [] }] }, ["source"], new Map([["source", "A source quote in context"]]))).not.toThrow();
  });
  it("rejects invalid labels, missing citations, foreign citations and unsupported quotes", () => {
    for (const value of [{ ...supported, label: "proven" }, { ...supported, sourceIds: [] }, { ...supported, sourceIds: ["foreign"] }, { ...supported, text: "invented" }]) {
      expect(() => checkClaims({ nested: value }, ["source"], new Map([["source", "A source quote"]]))).toThrow();
    }
  });
  it("uses the compared version's own cards, not another version's neighbors", () => expect(() => checkClaims(supported, [])).toThrow("outside"));
});

