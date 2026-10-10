"use client";

import { useEffect, useRef, useState } from "react";
import { setState, useAppState } from "@/lib/store";
import "./shell.css";

export const DESTINATIONS = [
  { id: "explore", label: "Explore" },
  { id: "talk", label: "Talk" },
  { id: "idea", label: "Idea" },
  { id: "decide", label: "Decide" },
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
          {d.label}
        </a>
      ))}
    </nav>
  );
}
