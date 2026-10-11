// The story's stage timing (specs/features/idea-scan, Plan 5): everything the overlay shows is a pure function of the
// story clock `t`, so a pause, a beat skip or a seek moves it with the camera. No DOM; unit-tested.

import { BEAT_AT, BEATS, COUNT_UP, END, LINES, TWIN_AT, type Beat } from "./story";

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

export const beatEnd = (b: Beat) => {
  const next = BEATS[BEATS.indexOf(b) + 1];
  return next ? BEAT_AT[next] : END;
};

// Fred's line on screen at t (an index into LINES, or -1): from its `at` until the next line's `at` or its beat's end.
export function lineAt(t: number): number {
  for (let i = LINES.length - 1; i >= 0; i--) {
    if (t < LINES[i].at) continue;
    return t < Math.min(LINES[i + 1]?.at ?? END, beatEnd(LINES[i].beat)) ? i : -1;
  }
  return -1;
}

// The sky beat's counter: 0 to total between COUNT_UP.from and .to, eased out (fast, then settling on the real total).
export const countAt = (t: number, total: number) => Math.round(total * easeOut((t - COUNT_UP.from) / (COUNT_UP.to - COUNT_UP.from)));

// Which twin's chime the clock crossed between two frames (-1 for none). Only a natural step counts: forward and under
// `max` seconds, so a seek, a beat skip or a backgrounded tab catching up never rings.
export function crossed(prev: number | null, t: number, twins: number, max = 0.5): number {
  if (prev === null || t <= prev || t - prev > max) return -1;
  return TWIN_AT.findIndex((at, k) => k < twins && prev < at && at <= t);
}

// Fred's lips move while the line types (the bubble types at 40 characters a second).
export const typingEnds = (i: number) => LINES[i].at + [...LINES[i].text].length / 40;
