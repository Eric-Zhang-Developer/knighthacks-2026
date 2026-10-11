import { describe, expect, it } from "vitest";
import { countAt, crossed, lineAt } from "@/components/scan/stage";

describe("story stage timing", () => {
  it("shows each line from its at until the next line or its beat's end", () => {
    expect(lineAt(1)).toBe(-1);
    expect(lineAt(1.5)).toBe(0);
    expect(lineAt(7.2)).toBe(-1); // sky line ends with the sky beat
    expect(lineAt(8)).toBe(1);
    expect(lineAt(15)).toBe(-1);
    expect(lineAt(35)).toBe(4);
  });
  it("counts from 0 to the real total", () => {
    expect(countAt(0, 76316)).toBe(0);
    expect(countAt(6, 76316)).toBe(76316);
  });
  it("chimes only on a natural forward step across a twin", () => {
    expect(crossed(12.99, 13.01, 3)).toBe(0);
    expect(crossed(16.99, 17.01, 3)).toBe(2);
    expect(crossed(16.99, 17.01, 2)).toBe(-1); // no third twin
    expect(crossed(12, 23, 3)).toBe(-1); // a beat skip
    expect(crossed(null, 13.01, 3)).toBe(-1); // just after a seek
    expect(crossed(13.01, 12.99, 3)).toBe(-1);
  });
});
