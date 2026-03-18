export const FEMATA_DB_NAME = "femata-ripoti-offline";
export const FEMATA_DB_VERSION = 1;
export const REPORT_QUEUE_STORE = "reportQueue";

const openRequest = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(FEMATA_DB_NAME, FEMATA_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(REPORT_QUEUE_STORE)) {
        const store = database.createObjectStore(REPORT_QUEUE_STORE, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });

export const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>,
): Promise<T> => {
  const database = await openRequest();

  try {
    const transaction = database.transaction(REPORT_QUEUE_STORE, mode);
    const store = transaction.objectStore(REPORT_QUEUE_STORE);
    return await run(store);
  } finally {
    database.close();
  }
};

export const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
