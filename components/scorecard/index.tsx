"use client";

import { useEffect, useState } from "react";
import { initWorkspace } from "@/components/workspace/api";
import { setState, useAppState } from "@/lib/store";
import ScorecardView from "./ScorecardView";
import type { Scorecard, View } from "./scorecard";

async function call(versionId: string, method: "GET" | "POST"): Promise<{ status: number; card?: Scorecard; error?: string }> {
  if (!(await initWorkspace()).ok) return { status: 0, error: "No workspace" };
  try {
    const res = await fetch(`/api/scorecard/${versionId}`, { method });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { status: res.status, card: json as Scorecard } : { status: res.status, error: (json as { error?: string }).error ?? `HTTP ${res.status}` };
  } catch {
    return { status: 0, error: "Network error" };
  }
}

// The active version's scorecard. The newest stored one loads for free; scoring is a model call, so it waits for the
// button. A cited project opens the drawer, as the evidence panel's cards do.
export default function ScorecardPanel() {
  const active = useAppState((s) => s.activeIdeaVersionId);
  const [view, setView] = useState<View>({ kind: "loading" });

  useEffect(() => {
    if (!active) return;
    let current = true;
    setView({ kind: "loading" });
    call(active, "GET").then((r) => {
      if (current) setView(r.card ? { kind: "ready", card: r.card } : r.status === 404 ? { kind: "empty" } : { kind: "failed", error: r.error! });
    });
    return () => {
      current = false;
    };
  }, [active]);

  if (!active) return null;
  async function score() {
    setView({ kind: "scoring" });
    const r = await call(active!, "POST");
    setView(r.card ? { kind: "ready", card: r.card } : { kind: "failed", error: r.error! });
  }
  return <ScorecardView view={view} onScore={score} onOpen={(id) => setState({ selectedProjectId: id })} />;
}
