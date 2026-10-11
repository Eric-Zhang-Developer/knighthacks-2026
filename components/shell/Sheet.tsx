"use client";

import { useRef, type ReactNode } from "react";
import { setState, useAppState } from "@/lib/store";
import { project, spring } from "./spring";

// The open project, as a sheet on the phone (a plain slot on desktop). It hangs from the top of the screen, so the
// search, explainer and push-to-talk below stay reachable, and it leaves the way it came: drag the handle up to
// dismiss. The drag tracks the finger 1:1; on release a flick's projected end decides close or stay, and a spring
// (damping 0.8, response 0.3) carries the release velocity there (apple-design §2, §5, §6).
export default function Sheet({ children }: { children: ReactNode }) {
  const selected = useAppState((s) => s.selectedProjectId);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; trail: { y: number; t: number }[] } | null>(null);
  const stop = useRef<() => void>(() => {});

  const move = (dy: number) => {
    // Upward follows the finger; downward resists, since there's nothing below the resting place (rubber band).
    const y = dy < 0 ? dy : (dy * 120 * 0.55) / (120 + 0.55 * dy);
    if (ref.current) ref.current.style.transform = `translateY(${y}px)`;
    return y;
  };

  return (
    <div ref={ref} className="shell-sheet" data-open={selected ? "true" : undefined}>
      {children}
      {selected && (
        <div
          className="shell-sheet-handle"
          role="button"
          tabIndex={-1}
          aria-label="Drag up to close"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            stop.current();
            drag.current = { y: e.clientY, trail: [{ y: e.clientY, t: e.timeStamp }] };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            move(e.clientY - d.y);
            d.trail.push({ y: e.clientY, t: e.timeStamp });
            if (d.trail.length > 6) d.trail.shift();
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            if (!d || !ref.current) return;
            const from = move(e.clientY - d.y);
            const first = d.trail.find((s) => e.timeStamp - s.t < 100);
            const velocity = first && e.timeStamp > first.t ? ((e.clientY - first.y) / (e.timeStamp - first.t)) * 1000 : 0;
            const height = ref.current.offsetHeight;
            const close = from + project(velocity) < -height * 0.35;
            stop.current = spring({
              from,
              to: close ? -height : 0,
              velocity,
              damping: 0.8,
              response: 0.3,
              onUpdate: (y) => ref.current && (ref.current.style.transform = `translateY(${y}px)`),
              onDone: () => {
                if (ref.current) ref.current.style.transform = "";
                if (close) setState({ selectedProjectId: null });
              },
            });
            drag.current = null;
          }}
        >
          <span aria-hidden />
        </div>
      )}
    </div>
  );
}
