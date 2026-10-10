// Shape pinned by build-plan-api (lib/plan/contract.ts, specs/decisions/build-plan-api-contract.md).
import type { ClaimLabel } from "@/components/ui";

type Sourced = { label: ClaimLabel; sourceIds: string[] };
export type Plan = { id: string; versionId: string; createdAt: string; hoursLeft: number; teamSize: number; skills: string[];
  tour: ({ text: string } & Sourced)[]; cut: ({ text: string } & Sourced)[];
  timeline: ({ hour: number; goal: string } & Sourced)[]; risks: ({ risk: string; countermeasure: string } & Sourced)[] };
export type View = { kind: "loading" | "empty" | "generating" } | { kind: "failed"; error: string } | { kind: "ready"; plan: Plan };

export const DEFAULTS = { hours: 10, team: 2 } as const;
// The API's bounds: hoursLeft 2–72, teamSize 1–20 whole people.
export const validInput = (hours: number, team: number) =>
  Number.isFinite(hours) && hours >= 2 && hours <= 72 && Number.isInteger(team) && team >= 1 && team <= 20;
// Timeline hours are elapsed offsets from now ("+1.5 h"), not clock times.
export const hourLabel = (h: number) => `+${Number.isInteger(h) ? h : h.toFixed(1)} h`;
