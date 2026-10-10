import { expect, test } from "vitest";
import { getState, initialState, setState, subscribe } from "@/lib/store";

test("setState merges the patch and notifies subscribers", () => {
  let calls = 0;
  const unsubscribe = subscribe(() => calls++);
  setState({ selectedProjectId: "p1" });
  expect(getState()).toEqual({ ...initialState, selectedProjectId: "p1" });
  expect(calls).toBe(1);
  unsubscribe();
  setState({ ideaDraft: "x" });
  expect(calls).toBe(1);
});
