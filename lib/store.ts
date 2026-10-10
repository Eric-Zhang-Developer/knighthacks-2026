import { useSyncExternalStore } from "react";

// The one client store features share. Select a field, not a derived object: a selector that builds a new
// object or array on every call re-renders forever.
export type IdeaStar = { versionId: string; x: number; y: number; z: number };

export type AppState = {
  selectedProjectId: string | null;
  highlightedIds: string[];
  ideaStars: IdeaStar[];
  activeIdeaVersionId: string | null;
  ideaDraft: string;
};

export const initialState: AppState = {
  selectedProjectId: null,
  highlightedIds: [],
  ideaStars: [],
  activeIdeaVersionId: null,
  ideaDraft: "",
};

let state = initialState;
const listeners = new Set<() => void>();

export const getState = () => state;

export function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAppState<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(initialState));
}

// The chosen idea version, remembered per workspace in this browser so a reload comes back to it. Storage can be
// blocked (private windows, settings): every access is guarded, and then the page simply starts on the newest idea.
const activeKey = (workspaceId: string) => `uncharted:active-version:${workspaceId}`;

export function rememberActive(workspaceId: string, versionId: string | null) {
  try {
    if (versionId) localStorage.setItem(activeKey(workspaceId), versionId);
    else localStorage.removeItem(activeKey(workspaceId));
  } catch {
    /* storage blocked: nothing is remembered */
  }
}

export function rememberedActive(workspaceId: string): string | null {
  try {
    return localStorage.getItem(activeKey(workspaceId));
  } catch {
    return null;
  }
}
