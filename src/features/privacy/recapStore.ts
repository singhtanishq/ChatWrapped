/**
 * Opt-in local recap persistence (Module H).
 *
 * IndexedDB is used ONLY when the user explicitly saves a recap. Recaps
 * contain aggregate statistics only — never raw conversation text.
 * Deleting a recap or clearing all data fully removes the object store rows.
 */

import type { SavedRecap } from "@/app/store";

const DB_NAME = "chatwrapped";
const DB_VERSION = 1;
const STORE = "recaps";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
    tx.oncomplete = () => db.close();
  });
}

export async function loadSavedRecaps(): Promise<SavedRecap[]> {
  try {
    const all = await withStore<SavedRecap[]>(
      "readonly",
      (s) => s.getAll() as IDBRequest<SavedRecap[]>,
    );
    return all.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function persistRecap(recap: SavedRecap): Promise<void> {
  await withStore("readwrite", (s) => s.put(recap));
}

export async function deleteRecap(id: string): Promise<void> {
  await withStore("readwrite", (s) => s.delete(id));
}

export async function deleteAllRecaps(): Promise<void> {
  await withStore("readwrite", (s) => s.clear());
}
