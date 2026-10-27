export const DOCUMENT_KEY = 'purrductivity.dashboard';
export const RECOVERY_KEY = 'purrductivity.recovery';
export interface StorageAdapter {
  read(): Promise<unknown>;
  readBackup(): Promise<unknown>;
  write(raw: string): Promise<void>;
  backup(raw: unknown): Promise<void>;
  subscribe(listener: () => void): () => void;
  exclusive<T>(operation: () => Promise<T>): Promise<T>;
}
interface ChromeStorage {
  storage: {
    local: {
      get(key: string): Promise<Record<string, unknown>>;
      set(value: Record<string, unknown>): Promise<void>;
    };
    onChanged: {
      addListener(fn: (changes: Record<string, unknown>, area: string) => void): void;
      removeListener(fn: (changes: Record<string, unknown>, area: string) => void): void;
    };
  };
}
export function createStorageAdapter(): StorageAdapter {
  const chrome = (
    globalThis as typeof globalThis & {
      chrome?: ChromeStorage;
    }
  ).chrome;
  const extension = typeof location === 'undefined' || location.protocol === 'chrome-extension:';
  if (extension && !chrome?.storage?.local)
    throw new Error(
      'Extension storage is unavailable. Reload the extension after updating its storage permission.',
    );
  const exclusive = async <T>(operation: () => Promise<T>): Promise<T> => {
    if (!navigator.locks)
      return Promise.reject<T>(
        new Error(
          'Safe storage needs browser Web Locks. Use a current Edge version or localhost preview.',
        ),
      );
    return navigator.locks.request('purrductivity-document', operation);
  };
  if (extension && chrome)
    return {
      read: async () => (await chrome.storage.local.get(DOCUMENT_KEY))[DOCUMENT_KEY],
      readBackup: async () => (await chrome.storage.local.get(RECOVERY_KEY))[RECOVERY_KEY],
      write: (raw) => chrome.storage.local.set({ [DOCUMENT_KEY]: raw }),
      backup: (raw) =>
        chrome.storage.local.set({ [RECOVERY_KEY]: { capturedAt: new Date().toISOString(), raw } }),
      subscribe: (listener) => {
        const handler = (changes: Record<string, unknown>, area: string) => {
          if (area === 'local' && DOCUMENT_KEY in changes) listener();
        };
        chrome.storage.onChanged.addListener(handler);
        return () => chrome.storage.onChanged.removeListener(handler);
      },
      exclusive,
    };
  return {
    readBackup: async () => {
      const value = localStorage.getItem(RECOVERY_KEY);
      return value === null ? undefined : JSON.parse(value);
    },
    read: async () => {
      const value = localStorage.getItem(DOCUMENT_KEY);
      return value === null ? undefined : value;
    },
    write: async (raw) => {
      localStorage.setItem(DOCUMENT_KEY, raw);
    },
    backup: async (raw) => {
      localStorage.setItem(
        RECOVERY_KEY,
        JSON.stringify({ capturedAt: new Date().toISOString(), raw }),
      );
    },
    subscribe: (listener) => {
      const handler = (event: StorageEvent) => {
        if (event.key === DOCUMENT_KEY || event.key === null) listener();
      };
      addEventListener('storage', handler);
      return () => removeEventListener('storage', handler);
    },
    exclusive,
  };
}
