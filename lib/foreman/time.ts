// Shared by server and client components. milestones.toml times are EDT, so the page shows the event's clock.
export const TZ = "America/New_York";

const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
export function span(ms: number) {
  const s = Math.max(0, Math.floor(Math.abs(ms) / 1000));
  return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;
}
export const clock = (t: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(t);

// The replay's playhead (spec § The tour, Motion). Speed is `base` (replay ms per real ms) at cruise; it eases up
// from rest over RAMP_MS after play or resume, and slows over the last SETTLE_MS of cruise distance, never below
// FLOOR of cruise, so it still lands on `end`. CRUISE_MS is shorter than the ~24 s a full play takes: the two ramps
// add the rest (pinned in tests/foreman/board.test.ts).
export const CRUISE_MS = 22_000;
export const RAMP_MS = 1_000;
export const SETTLE_MS = 1_000;
const FLOOR = 0.25;
export function advance(at: number, end: number, base: number, sincePlay: number, dt: number): number {
  const u = Math.min(1, sincePlay / RAMP_MS);
  const rise = u * u * (3 - 2 * u); // smoothstep: no jolt at either end of the ramp
  const settle = Math.max(FLOOR, Math.min(1, (end - at) / (base * SETTLE_MS)));
  return Math.min(end, at + base * dt * Math.min(rise, settle));
}
