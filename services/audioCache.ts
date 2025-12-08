// IndexedDB 音频缓存服务
const DB_NAME = "translator-audio-cache";
const DB_VERSION = 2; // 升级版本以支持新字段
const STORE_NAME = "audio";
const MAX_CACHE_SIZE = 50; // 最多缓存50条

export type AudioFormat = "pcm" | "mp3";

interface CacheEntry {
  key: string; // text 的 hash
  text: string;
  audioData: ArrayBuffer;
  format: AudioFormat;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });

  return dbPromise;
}

// 简单的字符串 hash
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export async function getCachedAudio(
  text: string
): Promise<{ data: ArrayBuffer; format: AudioFormat } | null> {
  try {
    const db = await openDB();
    const key = hashText(text);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;
        if (entry && entry.text === text && entry.format) {
          resolve({ data: entry.audioData, format: entry.format });
        } else {
          resolve(null);
        }
      };
    });
  } catch (e) {
    console.error("Failed to get cached audio:", e);
    return null;
  }
}

export async function setCachedAudio(
  text: string,
  audioData: ArrayBuffer,
  format: AudioFormat
): Promise<void> {
  try {
    const db = await openDB();
    const key = hashText(text);

    // 先清理旧缓存
    await cleanupOldCache(db);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      const entry: CacheEntry = {
        key,
        text,
        audioData,
        format,
        timestamp: Date.now(),
      };

      const request = store.put(entry);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (e) {
    console.error("Failed to cache audio:", e);
  }
}

async function cleanupOldCache(db: IDBDatabase): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("timestamp");

    const countRequest = store.count();
    countRequest.onsuccess = () => {
      const count = countRequest.result;
      if (count >= MAX_CACHE_SIZE) {
        // 删除最旧的记录
        const deleteCount = count - MAX_CACHE_SIZE + 10; // 多删几条
        const cursor = index.openCursor();
        let deleted = 0;

        cursor.onsuccess = (event) => {
          const result = (event.target as IDBRequest).result;
          if (result && deleted < deleteCount) {
            result.delete();
            deleted++;
            result.continue();
          } else {
            resolve();
          }
        };
        cursor.onerror = () => resolve();
      } else {
        resolve();
      }
    };
    countRequest.onerror = () => resolve();
  });
}

export async function clearAudioCache(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (e) {
    console.error("Failed to clear audio cache:", e);
  }
}
