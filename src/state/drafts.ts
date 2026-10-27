import { useSyncExternalStore } from 'react';
export interface UnsavedDraft {
  id: string;
  label: string;
  text: string;
  orphaned: boolean;
}
const drafts = new Map<string, UnsavedDraft>();
let snapshot: UnsavedDraft[] = [];
const listeners = new Set<() => void>();
function publish() {
  snapshot = [...drafts.values()];
  listeners.forEach((listener) => listener());
}
export function rememberDraft(draft: UnsavedDraft) {
  drafts.set(draft.id, draft);
  publish();
}
export function forgetDraft(id: string) {
  if (drafts.delete(id)) publish();
}
export function useDrafts() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => snapshot,
  );
}
