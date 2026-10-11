import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Description } from "@/components/drawer";
import { EvidenceCard } from "@/components/evidence";

const GALLERY = "Gallery card only: Devpost lists a title and tagline; no description on record";
const drawer = (text: string) => renderToStaticMarkup(createElement(Description, { text }));
const claim = { text: "Unknown", label: "unverified" as const, sourceIds: [] };
const card = (excerptSource?: "description" | "tagline" | "title" | "unknown") => renderToStaticMarkup(createElement(EvidenceCard, { card: {
  projectId: "p", url: "https://example.test/p", title: "Plant rota", excerpt: "A shared watering rota", excerptSource, overlaps: [], differences: [], uncertainty: claim } }));

test("drawer: an empty or blank description says gallery card only; a real one shows the excerpt as before", () => {
  for (const blank of ["", "  \n "]) expect(drawer(blank)).toContain(GALLERY);
  const full = drawer("How it works, in detail.");
  expect(full).not.toContain("Gallery card");
  expect(full).toMatch(/^<p class="[^"]*">How it works, in detail\.<\/p>$/);
});

test("evidence: a tagline or title excerpt is headed as the gallery card; unknown says the text changed", () => {
  for (const source of ["tagline", "title"] as const) expect(card(source)).toContain("<p>From the gallery card (title and tagline only)</p><blockquote");
  expect(card("unknown")).toContain("<p>Source text has changed since this card was made</p><blockquote");
});

test("evidence: a description excerpt, or an older response without excerptSource, renders exactly as before", () => {
  const before = card(undefined);
  expect(card("description")).toBe(before);
  expect(before).not.toMatch(/gallery card|has changed/i);
  expect(before).toContain("Uncertainty and source excerpt");
});
