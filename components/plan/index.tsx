"use client";

import { useEffect, useState } from "react";
import { initWorkspace } from "@/components/workspace/api";
import { useAppState } from "@/lib/store";
import PlanView from "./PlanView";
import { DEFAULTS, type Plan, type View } from "./plan";

async function call(versionId: string, body?: { hoursLeft: number; teamSize: number }): Promise<{ status: number; plan?: Plan; error?: string }> {
  if (!(await initWorkspace()).ok) return { status: 0, error: "No workspace" };
  try {
    const res = await fetch(`/api/plan/${versionId}`, body
      ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
    const json = await res.json().catch(() => ({}));
    return res.ok ? { status: res.status, plan: json as Plan } : { status: res.status, error: (json as { error?: string }).error ?? `HTTP ${res.status}` };
  } catch {
    return { status: 0, error: "Network error" };
  }
}

// The Plan step for the active version. The newest stored plan loads for free; generating is a model call, so it
// waits for the button. Regenerating keeps the plans shown earlier readable below (the API returns only the newest).
export default function PlanStep() {
  const active = useAppState((s) => s.activeIdeaVersionId);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [previous, setPrevious] = useState<Plan[]>([]);
  const [latest, setLatest] = useState<Plan | null>(null); // the newest plan, shown or not
  const [hours, setHours] = useState<number>(DEFAULTS.hours);
  const [team, setTeam] = useState<number>(DEFAULTS.team);

  useEffect(() => {
    if (!active) return;
    let current = true;
    setView({ kind: "loading" });
    setPrevious([]);
    setLatest(null);
    call(active).then((r) => {
      if (!current) return;
      if (r.plan) {
        setHours(r.plan.hoursLeft);
        setTeam(r.plan.teamSize);
        setLatest(r.plan);
        setView({ kind: "ready", plan: r.plan });
      } else setView(r.status === 404 ? { kind: "empty" } : { kind: "failed", error: r.error! });
    });
    return () => {
      current = false;
    };
  }, [active]);

  if (!active) return null;
  async function generate() {
    setView({ kind: "generating" });
    const r = await call(active!, { hoursLeft: hours, teamSize: team });
    if (!r.plan) return setView({ kind: "failed", error: r.error! });
    if (latest) setPrevious((p) => [latest, ...p]);
    setLatest(r.plan);
    setView({ kind: "ready", plan: r.plan });
  }
  // While a new plan is generating or has failed, the newest one stays readable with the earlier ones.
  const earlier = view.kind !== "ready" && latest ? [latest, ...previous] : previous;
  return <PlanView view={view} previous={earlier} hours={hours} team={team} onHours={setHours} onTeam={setTeam} onGenerate={generate} />;
}
