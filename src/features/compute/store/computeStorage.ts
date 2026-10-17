import type { ComputeQueue } from "./computeQueueStore";

export async function computeStorage(owner: string, data?: ComputeQueue): Promise<ComputeQueue | undefined> {
  const request = indexedDB.open("aurora-capabilities", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("compute");
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    const transaction = database.transaction("compute", data === undefined ? "readonly" : "readwrite");
    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    const operation = data === undefined ? transaction.objectStore("compute").get(owner) : transaction.objectStore("compute").put(data, owner);
    await done;
    return data === undefined ? operation.result as ComputeQueue | undefined : data;
  } finally { database.close(); }
}
