import { useSyncExternalStore } from 'react';
import type { CardAppearance } from './model';
interface Tools {
  advanced: boolean;
  selecting: boolean;
  selected: string[];
  copied: CardAppearance | null;
  message: string;
}
let snapshot: Tools = {
  advanced: false,
  selecting: false,
  selected: [],
  copied: null,
  message: '',
};
const listeners = new Set<() => void>();
export const workspaceTools = {
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  update: (value: Partial<Tools>) => {
    snapshot = { ...snapshot, ...value };
    listeners.forEach((listener) => listener());
  },
  toggle: (id: string) =>
    workspaceTools.update({
      selected: snapshot.selected.includes(id)
        ? snapshot.selected.filter((value) => value !== id)
        : [...snapshot.selected, id],
    }),
};
export const useWorkspaceTools = () =>
  useSyncExternalStore(workspaceTools.subscribe, workspaceTools.getSnapshot);
