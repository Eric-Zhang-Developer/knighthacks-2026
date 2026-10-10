"use client";

import { useEffect, useState } from "react";

// Stub from bootstrap; the galaxy feature replaces it. Until then it only reports whether the corpus exists.
export default function Galaxy() {
  const [status, setStatus] = useState<"loading" | "missing" | number>("loading");

  useEffect(() => {
    fetch("/corpus/stars.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setStatus(data ? data.count : "missing"))
      .catch(() => setStatus("missing"));
  }, []);

  return (
    <p role="status" style={{ padding: 16, color: "var(--muted)" }}>
      {status === "loading" ? "Loading corpus…" : status === "missing" ? "Corpus not loaded" : `${status} projects indexed`}
    </p>
  );
}
