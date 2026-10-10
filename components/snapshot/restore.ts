"use client";

import { useEffect } from "react";
import { initWorkspace } from "@/components/workspace/api";
import { getState, rememberActive, rememberedActive, setState, subscribe } from "@/lib/store";

type Version = { ideaId: string; versionId: string; neighborIds: string[] };

const get = <T,>(path: string) => fetch(path).then((r) => (r.ok ? (r.json() as Promise<T>) : null), () => null);

// Any version of this workspace's ideas: /api/ideas lists only each idea's latest, so look through their trails.
async function findVersion(versionId: string): Promise<Version | null> {
  for (const idea of (await get<Version[]>("/api/ideas")) ?? []) {
    if (idea.versionId === versionId) return idea;
    const found = (await get<Version[]>(`/api/revisions/trail/${idea.ideaId}`))?.find((v) => v.versionId === versionId);
    if (found) return found;
  }
  return null;
}

// Brings back the idea version chosen before a reload. The idea panel restores saved ideas with the newest one
// active; once its stars are in the store, this switches to the remembered version if any of this workspace's idea
// trails still has it (a gone one is dropped silently), then remembers every later choice.
export function useRememberedVersion() {
  useEffect(() => {
    let cancelled = false;
    let stop = () => {};
    (async () => {
      // The same one-per-page-load start the workspace badge uses, so a first visit is covered too.
      const me = await initWorkspace();
      if (!me.ok || cancelled) return;
      const { workspaceId } = me.data;
      await new Promise<void>((resolve) => {
        if (getState().ideaStars.length) return resolve();
        const off = subscribe(() => getState().ideaStars.length && (off(), resolve()));
        stop = off;
      });
      if (cancelled) return;
      const wanted = rememberedActive(workspaceId);
      if (wanted && wanted !== getState().activeIdeaVersionId) {
        const v = await findVersion(wanted);
        if (cancelled) return;
        if (v) setState({ activeIdeaVersionId: v.versionId, highlightedIds: v.neighborIds });
        else rememberActive(workspaceId, null); // gone from this workspace: dropped silently
      }
      if (cancelled) return;
      let last = getState().activeIdeaVersionId;
      rememberActive(workspaceId, last);
      stop = subscribe(() => {
        const now = getState().activeIdeaVersionId;
        if (now !== last) rememberActive(workspaceId, (last = now));
      });
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, []);
}
