"use client";

import { useEffect } from "react";
import { initWorkspace } from "@/components/workspace/api";
import { getState, rememberActive, rememberedActive, setState, subscribe } from "@/lib/store";

type Version = { versionId: string; neighborIds: string[] };

// Brings back the idea version chosen before a reload. The idea panel restores saved ideas with the newest one
// active; once its stars are in the store, this switches to the remembered version if this workspace still has it
// (a gone one is dropped silently), then remembers every later choice.
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
      const { ideaStars, activeIdeaVersionId } = getState();
      if (wanted && wanted !== activeIdeaVersionId) {
        if (ideaStars.some((s) => s.versionId === wanted)) {
          const versions = await fetch("/api/ideas").then((r) => (r.ok ? (r.json() as Promise<Version[]>) : []), () => []);
          const v = versions.find((x) => x.versionId === wanted);
          if (v && !cancelled) setState({ activeIdeaVersionId: v.versionId, highlightedIds: v.neighborIds });
        } else {
          rememberActive(workspaceId, null);
        }
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
