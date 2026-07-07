import type { IKeyStore } from './message-cache.types';

const DB_NAME    = 'skychat-message-cache';
const DB_VERSION = 3;
const KEY_STORE  = 'keys';
const MSG_STORE  = 'messages';

export class WebKeyStore implements IKeyStore {
  private scope = '';
  private db: IDBDatabase | null = null;

  async initialize(scope: string): Promise<void> {
    this.scope = scope;
    const db = await this.openDb();
    await this.getOrCreateKey();
    this.db = db;
  }

  async getOrCreateKey(): Promise<CryptoKey> {
    const db     = await this.openDb();
    const stored = await this.getKeyRecord(db);
    if (stored) return stored.key;

    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    await this.putKeyRecord(db, key);
    return key;
  }

  async clearKey(): Promise<void> {
    const db = await this.openDb();
    const scope = this.scope;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(KEY_STORE, 'readwrite');
      tx.objectStore(KEY_STORE).delete(scope);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error ?? new Error('Could not clear key'));
    });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private openDb(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);

    return new Promise<IDBDatabase>((resolve, reject) => {
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
          store.createIndex('by-conversation-created', ['conversationId', 'createdAt'], { unique: false });
          store.createIndex('by-deleted',              'deletedAt',                     { unique: false });
        }
        // V2→V3: drop unused indexes
        if (event.oldVersion === 2) {
          const tx = (event.target as IDBOpenDBRequest).transaction!;
          const store = tx.objectStore(MSG_STORE);
          for (const name of ['by-conversation-id', 'by-cache-version', 'by-encryption-version'] as const) {
            if (store.indexNames.contains(name)) store.deleteIndex(name);
          }
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };
      request.onerror = () =>
        reject(request.error ?? new Error('Could not open message cache database'));
    });
  }

  private getKeyRecord(db: IDBDatabase): Promise<{ id: string; key: CryptoKey } | null> {
    return new Promise<{ id: string; key: CryptoKey } | null>((resolve, reject) => {
      const tx      = db.transaction(KEY_STORE, 'readonly');
      const request = tx.objectStore(KEY_STORE).get(this.scope);
      request.onsuccess = () =>
        resolve((request.result as { id: string; key: CryptoKey } | undefined) ?? null);
      request.onerror = () =>
        reject(request.error ?? new Error('Could not read key store'));
    });
  }

  private putKeyRecord(db: IDBDatabase, key: CryptoKey): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const tx      = db.transaction(KEY_STORE, 'readwrite');
      const request = tx.objectStore(KEY_STORE).put({ id: this.scope, key });
      request.onsuccess = () => resolve();
      request.onerror   = () =>
        reject(request.error ?? new Error('Could not write key store'));
    });
  }
}
