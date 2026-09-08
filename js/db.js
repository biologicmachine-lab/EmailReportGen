const DB_NAME = 'shiftReportDB';
const DB_VERSION = 1;
const STORE = 'photos';

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    try {
      result = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    t.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction aborted'));
  }));
}

export function putPhoto(id, blob) {
  return tx('readwrite', store => store.put(blob, id));
}

export function getPhoto(id) {
  return tx('readonly', store => store.get(id));
}

export function deletePhoto(id) {
  return tx('readwrite', store => store.delete(id));
}

export function clearPhotos() {
  return tx('readwrite', store => store.clear());
}

export function listPhotoIds() {
  return tx('readonly', store => store.getAllKeys());
}

// Remove blobs not referenced by any entry. Called after restore and
// after clearing-abandoned photos don't stay on the device-
export async function pruneOrphans(liveIds) {
  const live = new Set(liveIds);
  const all = await listPhotoIds();
  const dead = all.filter(id => !live.has(id));
  await Promise.all(dead.map(deletePhoto));
  return dead.length;
}

// Effort to ask iOS not to evict this origin under storage pressure.
// Safari may decline, app works either way.
export async function requestPersistence() {
  if (!navigator.storage || !navigator.storage.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

// Real numbers from the browser.
export async function estimate() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return { usage: usage || 0, quota: quota || 0 };
  } catch {
    return null;
  }
}
