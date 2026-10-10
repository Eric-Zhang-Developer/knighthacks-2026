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
