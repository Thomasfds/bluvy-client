// Shared IndexedDB connection + schema for the message cache, used by both
// WebMessageStore and WebKeyStore. Previously each store opened its own
// independent connection to the same database with a hand-duplicated
// onupgradeneeded block — this module is the single source of truth for both
// the schema and the connection itself, so there is only ever one live
// IDBDatabase connection to this database, and a future version bump can't
// desync between the two callers.

export const DB_NAME    = 'skychat-message-cache';
export const DB_VERSION = 3;
export const KEY_STORE  = 'keys';
export const MSG_STORE  = 'messages';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openMessageCacheDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = request.result;
        // V1→V2: full store reset
        if (event.oldVersion > 0 && event.oldVersion < 2) {
          if (db.objectStoreNames.contains(KEY_STORE)) db.deleteObjectStore(KEY_STORE);
          if (db.objectStoreNames.contains(MSG_STORE)) db.deleteObjectStore(MSG_STORE);
        }
        if (!db.objectStoreNames.contains(KEY_STORE)) {
          db.createObjectStore(KEY_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(MSG_STORE)) {
          const store = db.createObjectStore(MSG_STORE, { keyPath: 'id' });
          // Only indexes actually used by queries:
          //   by-conversation-created → queryByConversation*, queryAllIds, queryNewestId
          //   by-deleted              → pruneStale
          store.createIndex('by-conversation-created', ['conversationId', 'createdAt'], { unique: false });
          store.createIndex('by-deleted',              'deletedAt',                     { unique: false });
        }
        // V2→V3: drop unused indexes (by-conversation-id, by-cache-version, by-encryption-version)
        if (event.oldVersion === 2) {
          const tx    = (event.target as IDBOpenDBRequest).transaction!;
          const store = tx.objectStore(MSG_STORE);
          for (const name of ['by-conversation-id', 'by-cache-version', 'by-encryption-version'] as const) {
            if (store.indexNames.contains(name)) store.deleteIndex(name);
          }
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        // A future version bump opening a second connection would otherwise block
        // forever waiting for this one to close. Close proactively and drop the
        // cached promise so the next call re-opens at the new version.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () =>
        reject(request.error ?? new Error('Could not open message cache database'));
    });
  }
  return dbPromise;
}

// Closes the shared connection (used on scope change / logout to release the
// handle symmetrically with the native SQLite store's close()).
export function closeMessageCacheDb(): void {
  if (!dbPromise) return;
  void dbPromise.then(db => db.close());
  dbPromise = null;
}
