import type { Star } from "@/components/galaxy/stars";
import type { Hit } from "@/lib/search/neighbors";

export type Filters = { event: string; year: string }; // "" = any
export type Options = { events: { name: string; count: number }[]; years: number[] };

// Options come from the committed stars.json, never a typed list: events by project count (then name), years newest first.
export function filterOptions(stars: Pick<Star, "event" | "year">[]): Options {
  const events = new Map<string, number>();
  const years = new Set<number>();
  for (const s of stars) {
    if (s.event) events.set(s.event, (events.get(s.event) ?? 0) + 1);
    if (s.year) years.add(s.year);
  }
  return {
    events: [...events].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    years: [...years].sort((a, b) => b - a),
  };
}

// An empty query with a filter lists that filter's projects straight from stars.json: no request needed.
export const localMatches = (stars: Star[], { event, year }: Filters): Hit[] =>
  stars
    .filter((s) => (!event || s.event === event) && (!year || s.year === Number(year)))
    .map((s) => ({ id: s.id, title: s.title, tagline: null, event: s.event ?? null, year: s.year ?? null }));

// `year` is the year the project's Devpost page was created, not the event's year (galaxy-history Gaps).
// A project can be in several events and a hit names only its first; under an event filter the server has matched
// that event, so the result is labelled with it (specs/decisions/search-filters-ui-multi-event.md).
export const meta = (h: Pick<Hit, "event" | "year">, event = "") =>
  [event || h.event, h.year && `created ${h.year}`].filter(Boolean).join(" · ");

export function searchUrl(q: string, { event, year }: Filters) {
  const p = new URLSearchParams({ q });
  if (event) p.set("event", event);
  if (year) p.set("year", year);
  return `/api/search?${p}`;
}
