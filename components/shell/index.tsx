"use client";

import { useEffect, useRef, useState } from "react";
import { setState, useAppState } from "@/lib/store";
import "./shell.css";

// Icons: Material Icons outlines (Apache-2.0), inline so there's no icon font to load.
export const DESTINATIONS = [
  { id: "explore", label: "Explore", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5 7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z" },
  { id: "talk", label: "Talk", icon: "M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" },
  { id: "idea", label: "Idea", icon: "M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 0 1 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z" },
  { id: "decide", label: "Decide", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z" },
  { id: "plan", label: "Plan", icon: "M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6zm3.6 8h-3.36l-.4-2H7V6h5.36l.4 2H18v6z" },
] as const;
type Dest = (typeof DESTINATIONS)[number]["id"];
const PHONE = "(max-width: 720px)";

const fromHash = (): Dest => DESTINATIONS.find((d) => `#${d.id}` === location.hash)?.id ?? "explore";

// The phone's bottom navigation. The destination lives in the URL hash and on <html data-dest>, which
// app/page.module.css reads to show one destination at a time; desktop hides this bar and shows everything.
export default function Nav() {
  const [dest, setDest] = useState<Dest>("explore");
  const selected = useAppState((s) => s.selectedProjectId);
  const pushed = useRef(false);

  useEffect(() => {
    const read = () => setDest(fromHash());
    read();
    addEventListener("hashchange", read);
    return () => removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.dest = dest;
  }, [dest]);

  // On the phone an open project is a history entry, so Back closes it and leaves the destination alone.
  useEffect(() => {
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      setState({ selectedProjectId: null });
    };
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (selected && !pushed.current && matchMedia(PHONE).matches) {
      history.pushState(history.state, "");
      pushed.current = true;
    } else if (!selected && pushed.current) {
      pushed.current = false; // closed with its own button: drop the entry so Back doesn't reopen nothing
      history.back();
    }
  }, [selected]);

  return (
    <nav className="shell-nav" aria-label="Destinations">
      {DESTINATIONS.map((d) => (
        <a
          key={d.id}
          href={`#${d.id}`}
          aria-current={d.id === dest ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            history.replaceState(history.state, "", `#${d.id}`); // switching destinations isn't a Back step
            setDest(d.id);
          }}
        >
          <span className="shell-nav-icon" aria-hidden>
            <svg viewBox="0 0 24 24">
              <path d={d.icon} />
            </svg>
          </span>
          {d.label}
        </a>
      ))}
    </nav>
  );
}
