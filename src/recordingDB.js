const DB_NAME = "InceptStudioDB";
const DB_VERSION = 1;
const STORE_NAME = "recordings";

let db = null;

export function initDB() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = database.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });
        objectStore.createIndex("timestamp", "timestamp", { unique: false });
        objectStore.createIndex("url", "url", { unique: false });
      }
    };
  });
}

export async function saveRecordingWithId(
  recordingId,
  events,
  url = "",
  title = "",
  tabId = null
) {
  await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const objectStore = transaction.objectStore(STORE_NAME);
    const rec = {
      id: recordingId,
      events,
      url,
      title,
      timestamp: Date.now(),
      tabId,
    };
    const req = objectStore.put(rec);
    req.onsuccess = () => resolve(rec);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllRecordings() {
  await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const objectStore = transaction.objectStore(STORE_NAME);
    const req = objectStore.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteRecordingById(id) {
  await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const objectStore = transaction.objectStore(STORE_NAME);
    const req = objectStore.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllRecordings() {
  await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const objectStore = transaction.objectStore(STORE_NAME);
    const req = objectStore.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
