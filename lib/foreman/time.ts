// Shared by server and client components. milestones.toml times are EDT, so the page shows the event's clock.
export const TZ = "America/New_York";

const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
export function span(ms: number) {
  const s = Math.max(0, Math.floor(Math.abs(ms) / 1000));
  return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;
}
export const clock = (t: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(t);
