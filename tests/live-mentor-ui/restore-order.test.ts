import { afterEach, beforeEach, expect, test, vi } from "vitest";

// A hook-order harness, not a browser or persistence acceptance receipt.
const harness = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  state: { activeIdeaVersionId: null as string | null, ideaDraft: "", ideaStars: [] as unknown[] },
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [value, vi.fn()],
  useEffect: (effect: () => void | (() => void)) => { harness.effects.push(effect); },
}));
vi.mock("../../components/workspace/api", () => ({ initWorkspace: async () => ({ ok: true }) }));
vi.mock("../../lib/store", () => ({
  getState: () => harness.state,
  setState: (patch: unknown) => Object.assign(harness.state, patch),
  useAppState: (select: (state: typeof harness.state) => unknown) => select(harness.state),
}));
import IdeaManager from "../../components/mentor/IdeaManager";
import { IDEA_INTENT, IDEA_SELECTED } from "../../components/mentor/idea-management";

const saved = { ideaId: "idea-a", versionId: "version-a", title: "Saved idea", x: 0, y: 0, z: 0, neighborIds: [], createdAt: "2026-10-11T00:00:00Z" };
let cleanups: (() => void)[] = [];
let settle: (versions: unknown[]) => void;
let selected: unknown[];

beforeEach(() => {
  harness.effects = [];
  harness.state = { activeIdeaVersionId: null, ideaDraft: "", ideaStars: [] };
  selected = [];
  const events = new EventTarget();
  events.addEventListener(IDEA_SELECTED, (event) => selected.push((event as CustomEvent).detail));
  vi.stubGlobal("window", events);
  vi.stubGlobal("location", { hash: "" });
  vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => {
    settle = (versions) => resolve({ ok: true, json: async () => versions });
  })));
});
afterEach(() => { cleanups.forEach((cleanup) => cleanup()); cleanups = []; vi.unstubAllGlobals(); });
function mount() {
  IdeaManager({});
  cleanups = harness.effects.map((effect) => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === "function");
}
async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

test("initial effect setup does not invalidate the saved-idea restore", async () => {
  mount();
  await flush();
  settle([saved]);
  await flush();
  expect(harness.state.activeIdeaVersionId).toBe(saved.versionId);
  expect(selected).toEqual([saved]);
});

test("an explicit Add idea still supersedes a delayed initial restore", async () => {
  mount();
  await flush();
  window.dispatchEvent(new CustomEvent(IDEA_INTENT, { detail: { kind: "add" } }));
  settle([saved]);
  await flush();
  expect(harness.state.activeIdeaVersionId).toBeNull();
  expect(selected).toEqual([null]);
});

test("a draft typed during loading is not replaced by saved content", async () => {
  mount();
  await flush();
  harness.state.ideaDraft = "My new direction";
  settle([saved]);
  await flush();
  expect(harness.state.ideaDraft).toBe("My new direction");
  expect(harness.state.activeIdeaVersionId).toBeNull();
  expect(selected).toEqual([]);
});

test("Strict Mode effect cleanup and replay still restore the saved idea", async () => {
  mount();
  cleanups.forEach((cleanup) => cleanup());
  cleanups = harness.effects.map((effect) => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === "function");
  await flush();
  settle([saved]);
  await flush();
  expect(harness.state.activeIdeaVersionId).toBe(saved.versionId);
  expect(selected).toEqual([saved]);
});
