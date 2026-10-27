import { useSyncExternalStore } from 'react';
import { createStorageAdapter } from '../persistence/adapter';
import { Repository } from '../persistence/repository';
import { ConflictError } from './actions';
import type { Action } from './actions';
import type { DashboardDocument } from './model';
import { History, reverse } from './history';
export interface Snapshot {
  status: 'loading' | 'ready' | 'error';
  document: DashboardDocument | null;
  error: string;
  pending: number;
  raw?: unknown;
  canUndo: boolean;
  canRedo: boolean;
}
class DashboardStore {
  private snapshot: Snapshot = {
    status: 'loading',
    document: null,
    error: '',
    pending: 0,
    canUndo: false,
    canRedo: false,
  };
  private history = new History();
  private assetGuard: Promise<void> | null = null;
  private releaseGuard: (() => void) | null = null;
  private protectHistoryAssets(): Promise<void> {
    if (!this.assetGuard)
      this.assetGuard = new Promise<void>((resolve, reject) => {
        void navigator.locks
          .request('purrductivity-history-assets', { mode: 'shared' }, async () => {
            const released = new Promise<void>((done) => {
              this.releaseGuard = done;
            });
            resolve();
            await released;
          })
          .catch(reject);
      });
    return this.assetGuard;
  }
  private historyStatus() {
    this.publish({ canUndo: this.history.undo.length > 0, canRedo: this.history.redo.length > 0 });
  }
  private listeners = new Set<() => void>();
  private repository: Repository | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private started = false;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  private publish(update: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...update };
    for (const listener of this.listeners) listener();
  }
  private async failed(error: unknown) {
    let raw: unknown;
    try {
      raw = await this.repository?.recoverySource();
    } catch {
      /* Read errors preserve stored bytes and offer retry. */
    }
    this.publish({
      status: 'error',
      error: error instanceof Error ? error.message : 'Local storage is unavailable.',
      raw,
    });
  }
  async start() {
    if (this.started) return;
    this.started = true;
    try {
      await this.retry();
    } catch (error) {
      await this.failed(error);
    }
  }
  retry = async () => {
    this.publish({ status: 'loading', error: '' });
    try {
      if (!this.repository) {
        this.repository = new Repository(createStorageAdapter());
        this.repository.subscribe(() => {
          void this.refresh();
        });
      }
      const document = await this.repository.load();
      this.publish({ status: 'ready', document, error: '', raw: undefined });
    } catch (error) {
      await this.failed(error);
    }
  };
  private refresh() {
    // Queue notifications behind local writes so an earlier read cannot replace a newer result.
    this.queue = this.queue.then(async () => {
      try {
        const document = await this.repository!.read();
        this.publish({ status: 'ready', document, error: '', raw: undefined });
      } catch (error) {
        await this.failed(error);
      }
    });
    return this.queue;
  }
  dispatch = (action: Action): Promise<void> => {
    this.publish({ pending: this.snapshot.pending + 1 });
    const operation = this.queue.then(async () => {
      if (this.snapshot.status !== 'ready' || !this.repository)
        throw new Error('Storage is not ready. Your edit has not been saved.');
      try {
        if (action.type !== 'front' && action.type !== 'timer') await this.protectHistoryAssets();
        const change = await this.repository.change(action);
        this.history.record(change, action);
        this.publish({ document: change.after, error: '' });
        this.historyStatus();
      } catch (error) {
        if (error instanceof ConflictError) {
          try {
            const document = await this.repository.read();
            this.publish({ document });
          } catch (readError) {
            await this.failed(readError);
          }
        } else await this.failed(error);
        throw error;
      }
    });
    this.queue = operation.catch(() => undefined);
    return operation.finally(() => this.publish({ pending: this.snapshot.pending - 1 }));
  };
  travel = (direction: 'undo' | 'redo'): Promise<void> => {
    this.publish({ pending: this.snapshot.pending + 1 });
    const operation = this.queue.then(async () => {
      if (!this.repository || this.snapshot.status !== 'ready')
        throw Error('Storage is not ready.');
      const entry = this.history[direction].at(-1);
      if (!entry) return;
      try {
        const change = await this.repository.history(
          direction === 'undo' ? reverse(entry.patches) : entry.patches,
        );
        this.history.complete(direction, change);
        this.publish({ document: change.after });
        this.historyStatus();
      } catch (error) {
        if (error instanceof ConflictError)
          throw new Error(
            'This history item conflicts with newer saved changes. Those changes were kept.',
            { cause: error },
          );
        throw error;
      }
    });
    this.queue = operation.catch(() => undefined);
    return operation.finally(() => this.publish({ pending: this.snapshot.pending - 1 }));
  };
  previous = async () => {
    await this.queue;
    if (!this.repository) throw Error('Storage is not ready.');
    return this.repository.previous();
  };
  replace = (expected: DashboardDocument, replacement: DashboardDocument): Promise<void> => {
    this.publish({ pending: this.snapshot.pending + 1 });
    const operation = this.queue.then(async () => {
      if (!this.repository || this.snapshot.status !== 'ready')
        throw Error('Storage is not ready.');
      const document = await this.repository.replace(expected, replacement);
      this.history.clear();
      this.releaseGuard?.();
      this.releaseGuard = null;
      this.assetGuard = null;
      this.publish({ document, error: '' });
      this.historyStatus();
    });
    this.queue = operation.catch(() => undefined);
    return operation.finally(() => this.publish({ pending: this.snapshot.pending - 1 }));
  };
  reconcile = (): Promise<void> => {
    const operation = this.queue.then(async () => {
      if (this.snapshot.status !== 'ready' || !this.repository) return;
      try {
        const document = await this.repository.reconcile(
          Date.now(),
          location.protocol !== 'chrome-extension:',
        );
        this.publish({ document });
      } catch (error) {
        await this.failed(error);
      }
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  };
  recover = async () => {
    try {
      if (!this.repository) throw new Error('Storage unavailable. Retry first.');
      const document = await this.repository.recover(this.snapshot.raw);
      this.publish({ status: 'ready', document, raw: undefined, error: '' });
    } catch (error) {
      await this.failed(error);
    }
  };
}
export const dashboardStore = new DashboardStore();
export function useDashboard() {
  return useSyncExternalStore(dashboardStore.subscribe, dashboardStore.getSnapshot);
}
