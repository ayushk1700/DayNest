export interface RecentPdfFile {
  id: string;
  name: string;
  size: number;
  lastOpened: number;
  title: string;
  author: string;
  pageCount: number;
  folder?: string;
  data: ArrayBuffer;
}

const databaseName = 'daynest-pdf-studio';
const storeName = 'recent-files';
const recentLimit = 8;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined')
    return Promise.reject(new Error('Local recent files are unavailable in this browser.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName))
        request.result.createObjectStore(storeName, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Could not access local recent files.'));
  });
}

export async function listRecentPdfs(): Promise<RecentPdfFile[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).getAll() as IDBRequest<RecentPdfFile[]>;
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.lastOpened - a.lastOpened));
    request.onerror = () =>
      reject(request.error ?? new Error('Could not read local recent files.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Could not read local recent files.'));
    };
  });
}

export async function getRecentPdf(id: string): Promise<RecentPdfFile | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(id) as IDBRequest<
      RecentPdfFile | undefined
    >;
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error ?? new Error('Could not open this recent PDF.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Could not open this recent PDF.'));
    };
  });
}

export async function saveRecentPdf(
  file: Omit<RecentPdfFile, 'data' | 'lastOpened'> & { data: Uint8Array; lastOpened?: number },
): Promise<void> {
  const database = await openDatabase();
  const bytes = new Uint8Array(file.data.byteLength);
  bytes.set(file.data);
  const record: RecentPdfFile = {
    ...file,
    data: bytes.buffer,
    lastOpened: file.lastOpened ?? Date.now(),
  };
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.put(record);
    const all = store.getAll() as IDBRequest<RecentPdfFile[]>;
    all.onsuccess = () => {
      all.result
        .sort((a, b) => b.lastOpened - a.lastOpened)
        .slice(recentLimit)
        .forEach((stale) => store.delete(stale.id));
    };
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Could not save this PDF in local recents.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Could not save this PDF in local recents.'));
    };
  });
}

export async function removeRecentPdf(id: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Could not remove this recent PDF.'));
    };
  });
}
