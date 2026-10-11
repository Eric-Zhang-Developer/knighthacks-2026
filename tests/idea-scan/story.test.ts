import { describe, expect, it } from "vitest";
import { BEAT_AT, END, findTwins, LINES, Story, TWIN_AT, beatAt } from "@/components/scan/story";

describe("story timeline", () => {
  it("runs 30-40 s, beats in order, every line and twin inside its beat", () => {
    expect(END).toBeGreaterThanOrEqual(30);
    expect(END).toBeLessThanOrEqual(40);
    for (const l of LINES) expect(beatAt(l.at)).toBe(l.beat);
    for (const t of TWIN_AT) expect(beatAt(t)).toBe("twins");
    expect(beatAt(0)).toBe("sky");
    expect(beatAt(BEAT_AT.turn + 1)).toBe("turn");
  });

  it("finds twins by exact title and year, skipping a missing one", () => {
    const stars = [
      { id: "a", title: "UCF Parking", year: 2021, event: "Knight Hacks" },
      { id: "b", title: "Knight Parking", year: 2016, event: "Knight Hacks" },
      { id: "c", title: "UCF Parking Agent", year: 2020, event: null }, // wrong year: not a twin
    ];
    expect(findTwins(stars).map((t) => [t.id, t.index])).toEqual([["b", 1], ["a", 0]]);
  });
});

describe("Story clock", () => {
  it("pauses, steps beats, and ends at END", () => {
    const s = new Story();
    const seen: (string | null)[] = [];
    s.subscribe((st) => seen.push(st.beat));
    s.play(100);
    expect(s.state(103).beat).toBe("sky");
    s.toggle(103); // pause at t=3
    expect(s.state(150).t).toBe(3);
    s.toggle(150); // resume
    expect(s.state(151).t).toBe(4);
    s.step(151, 1);
    expect(s.state(151).beat).toBe("egg");
    s.step(151, -1);
    expect(s.state(151).beat).toBe("sky");
    s.seek(151, END - 0.1);
    s.tick(151.2);
    expect(s.state(151.2).playing).toBe(false);
    expect(seen.at(-1)).toBe(null);
  });

  it("with no twins, skips from the sky straight to the turn", () => {
    const s = new Story();
    s.play(0, 0);
    s.tick(BEAT_AT.egg + 0.1);
    expect(s.state(BEAT_AT.egg + 0.1).beat).toBe("turn");
  });
});
