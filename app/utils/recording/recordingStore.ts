/**
 * app/utils/recording/recordingStore.ts
 *
 * Keeps session recordings on the tablet (IndexedDB) until they are uploaded, the same way finished
 * runs wait in localStorage: a lost Wi-Fi connection or a reload must not lose a participant's recording.
 * Keyed by the run's queue key (study | participant | start time).
 */

const DB_NAME = 'tablet-recordings';
const STORE = 'recordings';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is not available'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export const saveRecording = (key: string, blob: Blob) =>
  run<IDBValidKey>('readwrite', (store) => store.put(blob, key));

export const loadRecording = (key: string) =>
  run<Blob | undefined>('readonly', (store) => store.get(key)).then((blob) => blob ?? null);

export const deleteRecording = (key: string) => run<undefined>('readwrite', (store) => store.delete(key));
