import type { EncryptedCacheRecord, IMessageStore } from './message-cache.types';

const DB_NAME    = 'skychat-message-cache';
const DB_VERSION = 3;
const KEY_STORE  = 'keys';
const MSG_STORE  = 'messages';

export class WebMessageStore implements IMessageStore {
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    this.db = await this.openDb();
    await this.pruneStale().catch(() => {});
  }

  async put(record: EncryptedCacheRecord): Promise<void> {
    const db = await this.openDb();
    return this.putRecord(db, record);
  }

  async putMany(records: EncryptedCacheRecord[]): Promise<void> {
    if (records.length === 0) return;
    const db = await this.openDb();
    return this.putManyRecords(db, records);
  }

  async has(id: string): Promise<boolean> {
    const db = await this.openDb();
    return this.hasRecord(db, id);
  }

  async get(id: string): Promise<EncryptedCacheRecord | null> {
    const db = await this.openDb();
    return this.getRecord(db, id);
  }

  async queryByConversation(conversationId: string, limit: number): Promise<EncryptedCacheRecord[]> {
    const db = await this.openDb();
    return this.queryByConversationImpl(db, conversationId, limit);
  }

  async queryAllIds(conversationId: string): Promise<string[]> {
    const db = await this.openDb();
    return this.queryAllIdsImpl(db, conversationId);
  }

  async queryNewestId(conversationId: string): Promise<string | null> {
    const db = await this.openDb();
    return this.queryNewestIdImpl(db, conversationId);
  }

  async queryByConversationPaged(
    conversationId: string,
    afterCreatedAt: number,
    limit: number,
  ): Promise<EncryptedCacheRecord[]> {
    const db = await this.openDb();
    return this.queryByConversationPagedImpl(db, conversationId, afterCreatedAt, limit);
  }

  async updateDeletedAt(id: string, deletedAt: number): Promise<void> {
    const db     = await this.openDb();
    const record = await this.getRecord(db, id);
    if (!record) return;
    await this.putRecord(db, { ...record, deletedAt });
  }

  async updateSenderDid(id: string, senderDid: string, isMine: boolean): Promise<boolean> {
    const db = await this.openDb();
    return new Promise<boolean>((resolve, reject) => {
      const tx    = db.transaction(MSG_STORE, 'readwrite');
      const store = tx.objectStore(MSG_STORE);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result as EncryptedCacheRecord | undefined;
        if (!record || record.senderDid === senderDid) { resolve(false); return; }
        const putReq = store.put({ ...record, senderDid, isMine });
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
      tx.oncomplete = () => resolve(true);
      tx.onerror    = () => reject(tx.error);
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.openDb();
    return new Promise<void>((resolve, reject) => {
      const tx      = db.transaction(MSG_STORE, 'readwrite');
      const request = tx.objectStore(MSG_STORE).delete(id);
      request.onsuccess = () => resolve();
      request.onerror   = () =>
        reject(request.error ?? new Error('Could not delete cache record'));
    });
  }

  async clear(): Promise<void> {
    const db = await this.openDb();
    return new Promise<void>((resolve, reject) => {
      const tx      = db.transaction(MSG_STORE, 'readwrite');
      const request = tx.objectStore(MSG_STORE).clear();
      request.onsuccess = () => resolve();
      request.onerror   = () =>
        reject(request.error ?? new Error('Could not clear message cache'));
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async updateSenderDidMany(updates: { id: string; senderDid: string; isMine: boolean }[]): Promise<void> {
    if (updates.length === 0) return;
    const db = await this.openDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MSG_STORE, 'readwrite');
      const store = tx.objectStore(MSG_STORE);
      
      let count = 0;
      const processNext = () => {
        if (count === updates.length) {
          return;
        }
        const { id, senderDid, isMine } = updates[count]!;
        const getRequest = store.get(id);
        getRequest.onsuccess = () => {
          const record = getRequest.result as EncryptedCacheRecord | null;
          if (record && record.senderDid !== senderDid) {
            const putRequest = store.put({ ...record, senderDid, isMine });
            putRequest.onsuccess = () => {
              count++;
              processNext();
            };
            putRequest.onerror = () => reject(putRequest.error);
          } else {
            count++;
            processNext();
          }
        };
        getRequest.onerror = () => reject(getRequest.error);
      };
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      
      processNext();
    });
  }

  async pruneStale(): Promise<void> {
    const db = await this.openDb();
    const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MSG_STORE, 'readwrite');
      const store = tx.objectStore(MSG_STORE);
      const index = store.index('by-deleted');
      
      const range = IDBKeyRange.upperBound(threshold);
      const request = index.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = (event.target as any).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
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
          // Only indexes actually used by queries:
          //   by-conversation-created → queryByConversation*, queryAllIds, queryNewestId
          //   by-deleted              → pruneStale
          store.createIndex('by-conversation-created', ['conversationId', 'createdAt'], { unique: false });
          store.createIndex('by-deleted',              'deletedAt',                     { unique: false });
        }
        // V2→V3: drop unused indexes (by-conversation-id, by-cache-version, by-encryption-version)
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

  private putRecord(db: IDBDatabase, record: EncryptedCacheRecord): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const tx      = db.transaction(MSG_STORE, 'readwrite');
      const request = tx.objectStore(MSG_STORE).put(record);
      request.onsuccess = () => resolve();
      request.onerror   = () =>
        reject(request.error ?? new Error('Could not write message cache'));
    });
  }

  private putManyRecords(db: IDBDatabase, records: EncryptedCacheRecord[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const tx    = db.transaction(MSG_STORE, 'readwrite');
      const store = tx.objectStore(MSG_STORE);
      let i = 0;

      const putNext = (): void => {
        if (i >= records.length) return;
        const req = store.put(records[i++]);
        req.onsuccess = putNext;
        req.onerror   = () =>
          reject(req.error ?? new Error('Batch write to cache failed'));
      };

      tx.oncomplete = () => resolve();
      tx.onerror    = () =>
        reject(tx.error ?? new Error('Batch write transaction failed'));
      putNext();
    });
  }

  private hasRecord(db: IDBDatabase, id: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const tx      = db.transaction(MSG_STORE, 'readonly');
      const request = tx.objectStore(MSG_STORE).count(id);
      request.onsuccess = () => resolve(request.result > 0);
      request.onerror   = () =>
        reject(request.error ?? new Error('Could not check cache'));
    });
  }

  private getRecord(db: IDBDatabase, id: string): Promise<EncryptedCacheRecord | null> {
    return new Promise<EncryptedCacheRecord | null>((resolve, reject) => {
      const tx      = db.transaction(MSG_STORE, 'readonly');
      const request = tx.objectStore(MSG_STORE).get(id);
      request.onsuccess = () =>
        resolve((request.result as EncryptedCacheRecord | undefined) ?? null);
      request.onerror = () =>
        reject(request.error ?? new Error('Could not read cache record'));
    });
  }

  private queryByConversationImpl(
    db: IDBDatabase,
    conversationId: string,
    limit: number,
  ): Promise<EncryptedCacheRecord[]> {
    return new Promise<EncryptedCacheRecord[]>((resolve, reject) => {
      const tx      = db.transaction(MSG_STORE, 'readonly');
      const index   = tx.objectStore(MSG_STORE).index('by-conversation-created');
      const range   = IDBKeyRange.bound(
        [conversationId, 0],
        [conversationId, Number.MAX_SAFE_INTEGER],
      );
      const results: EncryptedCacheRecord[] = [];
      const request = index.openCursor(range, 'prev');

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || results.length >= limit) {
          resolve(results.reverse());
          return;
        }
        results.push(cursor.value as EncryptedCacheRecord);
        cursor.continue();
      };
      request.onerror = () =>
        reject(request.error ?? new Error('Could not query message cache'));
    });
  }

  private queryAllIdsImpl(db: IDBDatabase, conversationId: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      const tx      = db.transaction(MSG_STORE, 'readonly');
      const index   = tx.objectStore(MSG_STORE).index('by-conversation-created');
      const range   = IDBKeyRange.bound(
        [conversationId, 0],
        [conversationId, Number.MAX_SAFE_INTEGER],
      );
      const ids: string[] = [];
      const request = index.openKeyCursor(range);

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { resolve(ids); return; }
        ids.push(cursor.primaryKey as string);
        cursor.continue();
      };
      request.onerror = () =>
        reject(request.error ?? new Error('Could not query cache IDs'));
    });
  }

  private queryByConversationPagedImpl(
    db: IDBDatabase,
    conversationId: string,
    afterCreatedAt: number,
    limit: number,
  ): Promise<EncryptedCacheRecord[]> {
    return new Promise<EncryptedCacheRecord[]>((resolve, reject) => {
      const tx      = db.transaction(MSG_STORE, 'readonly');
      const index   = tx.objectStore(MSG_STORE).index('by-conversation-created');
      // lowerOpen: true → strictly after afterCreatedAt (exclusive lower bound)
      const range   = IDBKeyRange.bound(
        [conversationId, afterCreatedAt],
        [conversationId, Number.MAX_SAFE_INTEGER],
        true,
        false,
      );
      const results: EncryptedCacheRecord[] = [];
      const request = index.openCursor(range, 'next'); // ASC by createdAt

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || results.length >= limit) {
          resolve(results);
          return;
        }
        results.push(cursor.value as EncryptedCacheRecord);
        cursor.continue();
      };
      request.onerror = () =>
        reject(request.error ?? new Error('Could not query paged message cache'));
    });
  }

  private queryNewestIdImpl(db: IDBDatabase, conversationId: string): Promise<string | null> {
    return new Promise<string | null>((resolve, reject) => {
      const tx      = db.transaction(MSG_STORE, 'readonly');
      const index   = tx.objectStore(MSG_STORE).index('by-conversation-created');
      const range   = IDBKeyRange.bound(
        [conversationId, 0],
        [conversationId, Number.MAX_SAFE_INTEGER],
      );
      const request = index.openKeyCursor(range, 'prev');

      request.onsuccess = () => {
        const cursor = request.result;
        resolve(cursor ? (cursor.primaryKey as string) : null);
      };
      request.onerror = () =>
        reject(request.error ?? new Error('Could not query newest ID'));
    });
  }
}
