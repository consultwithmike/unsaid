"use client";

/**
 * IndexedDB offline queue for assessment answers — FLOWS.md §7.
 * DB: unsaid-offline / store: pending_responses / key: `${checkId}:${questionCode}`
 */

export interface PendingResponse {
  key: string;
  checkId: string;
  questionCode: string;
  answer: number | string | string[];
  importance: number;
  hardLine: boolean;
  savedAt: number;
  retries: number;
}

const DB_NAME = "unsaid-offline";
const STORE_NAME = "pending_responses";
const DB_VERSION = 1;
const MAX_RETRIES = 5;

function hasIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function queueKey(checkId: string, questionCode: string) {
  return `${checkId}:${questionCode}`;
}

export async function enqueuePendingResponse(
  entry: Omit<PendingResponse, "key" | "savedAt" | "retries">,
): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({
        ...entry,
        key: queueKey(entry.checkId, entry.questionCode),
        savedAt: Date.now(),
        retries: 0,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Best-effort — offline queue is a resilience layer, not the source of truth.
  }
}

export async function removePendingResponse(key: string): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function bumpRetry(entry: PendingResponse): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ ...entry, retries: entry.retries + 1 });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function getAllPendingResponses(
  checkId?: string,
): Promise<PendingResponse[]> {
  if (!hasIndexedDb()) return [];
  try {
    const db = await openDb();
    return await new Promise<PendingResponse[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const all = (req.result as PendingResponse[]) ?? [];
        resolve(checkId ? all.filter((r) => r.checkId === checkId) : all);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Flushes the queue FIFO, POSTing each pending response. Removes on success;
 * drops entries that exceed MAX_RETRIES so the queue can't jam forever.
 */
export async function flushPendingResponses(
  checkId: string,
  submit: (entry: PendingResponse) => Promise<boolean>,
): Promise<void> {
  const pending = await getAllPendingResponses(checkId);
  pending.sort((a, b) => a.savedAt - b.savedAt);
  for (const entry of pending) {
    const success = await submit(entry);
    if (success) {
      await removePendingResponse(entry.key);
    } else if (entry.retries + 1 >= MAX_RETRIES) {
      await removePendingResponse(entry.key);
    } else {
      await bumpRetry(entry);
    }
  }
}
