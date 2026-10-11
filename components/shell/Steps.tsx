"use client";

import { useEffect, useRef, useState } from "react";
import { useAppState } from "@/lib/store";

// The idea path in brainstorming order (app/page.tsx groups the panels under these ids).
const STEPS = [
  { id: "idea", label: "Idea" },
  { id: "explore", label: "Explore" },
  { id: "grow", label: "Grow" },
  { id: "test", label: "Test" },
  { id: "decide", label: "Decide" },
  { id: "plan", label: "Plan" },
] as const;

const group = (id: string) => document.getElementById(`step-${id}`);
// A step counts once one of its panels is on screen (not hidden by the phone's destination).
const present = () => STEPS.filter((s) => group(s.id)?.querySelector(".ui-panel") && group(s.id)!.offsetParent !== null).map((s) => s.id);

// Wayfinding for the contextual rail: where you are on the path and where you can go next. It jumps to a step's
// panels instead of hiding the others, so every panel stays where its own feature put it. Only shown once an idea
// exists and there's more than one step to move between, so the first screen stays a single prompt.
export default function Steps() {
  const active = useAppState((s) => s.activeIdeaVersionId);
  const [steps, setSteps] = useState<string[]>([]);
  const [current, setCurrent] = useState<string>("idea");
  // A step the person just chose stays pinned to the top for a moment while panels above it are still loading in
  // and growing; any scroll of their own lets go.
  const pin = useRef<{ id: string; until: number } | null>(null);

  useEffect(() => {
    const rail = document.querySelector('aside[aria-label="Idea and evidence"]');
    if (!rail) return;
    const update = () => setSteps((prev) => {
      const next = present();
      return prev.join() === next.join() ? prev : next;
    });
    update();
    const settle = () => {
      const p = pin.current;
      if (!p) return;
      if (performance.now() > p.until) pin.current = null;
      else group(p.id)?.scrollIntoView({ block: "start" });
    };
    const mo = new MutationObserver(() => (update(), settle()));
    mo.observe(rail, { childList: true, subtree: true });
    const ro = new ResizeObserver(settle);
    rail.querySelectorAll("[id^=step-]").forEach((g) => ro.observe(g));
    const letGo = () => (pin.current = null);
    rail.addEventListener("wheel", letGo, { passive: true });
    rail.addEventListener("touchstart", letGo, { passive: true });
    addEventListener("hashchange", update); // the phone's destination changes what's on screen
    // The current step is the first group whose top half is in view.
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id.slice(5), e.isIntersecting);
        const first = STEPS.find((s) => seen.get(s.id));
        if (first) setCurrent(first.id);
      },
      { root: rail, rootMargin: "-56px 0px -50% 0px" },
    );
    STEPS.forEach((s) => group(s.id) && io.observe(group(s.id)!));
    return () => {
      mo.disconnect();
      ro.disconnect();
      io.disconnect();
      removeEventListener("hashchange", update);
      rail.removeEventListener("wheel", letGo);
      rail.removeEventListener("touchstart", letGo);
    };
  }, []);

  if (!active || steps.length < 2) return null;
  return (
    <nav className="shell-steps" aria-label="Idea steps">
      {STEPS.filter((s) => steps.includes(s.id)).map((s) => (
        <a
          key={s.id}
          href={`#step-${s.id}`}
          aria-current={s.id === current ? "step" : undefined}
          onClick={(e) => {
            e.preventDefault(); // the URL hash belongs to the phone's destinations
            const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
            group(s.id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
            pin.current = { id: s.id, until: performance.now() + 2500 };
            setCurrent(s.id);
          }}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}
