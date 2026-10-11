"use client";

import { useEffect, useState } from "react";

// Desktop's two places (specs/features/header-nav): Explore is the galaxy, Build gives the idea path the stage. One
// route; the view lives in the hash (#build) and on <html data-view>, which app/page.module.css reads. Switching never
// touches app state, so the draft, the open project and the saved idea carry across. The phone keeps <Nav>.
const VIEWS = [
  { id: "explore", label: "Explore" },
  { id: "build", label: "Build" },
] as const;
type View = (typeof VIEWS)[number]["id"];

const fromHash = (): View => (location.hash === "#build" ? "build" : "explore");

export default function Tabs() {
  const [view, setView] = useState<View>("explore");

  useEffect(() => {
    const read = () => setView(fromHash());
    read();
    addEventListener("hashchange", read);
    return () => removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.view = view;
  }, [view]);

  return (
    <nav className="shell-tabs" aria-label="Views">
      {VIEWS.map((v) => (
        <a
          key={v.id}
          href={`#${v.id}`}
          aria-current={v.id === view ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            history.replaceState(history.state, "", `#${v.id}`); // a view isn't a Back step, as on the phone
            setView(v.id);
          }}
        >
          {v.label}
        </a>
      ))}
    </nav>
  );
}
