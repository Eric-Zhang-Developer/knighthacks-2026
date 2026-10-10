import { afterEach, expect, test, vi } from "vitest";
import { rememberActive, rememberedActive } from "@/lib/store";

afterEach(() => vi.unstubAllGlobals());

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

test("the chosen version is remembered per workspace and can be forgotten", () => {
  vi.stubGlobal("localStorage", memoryStorage());
  rememberActive("w1", "v2");
  rememberActive("w2", "v9");
  expect(rememberedActive("w1")).toBe("v2");
  expect(rememberedActive("w2")).toBe("v9");
  rememberActive("w1", null);
  expect(rememberedActive("w1")).toBeNull();
});

test("blocked storage never throws: nothing is remembered", () => {
  const blocked = () => {
    throw new DOMException("blocked", "SecurityError");
  };
  vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked, removeItem: blocked });
  expect(() => rememberActive("w1", "v2")).not.toThrow();
  expect(rememberedActive("w1")).toBeNull();
});
