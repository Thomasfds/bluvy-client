import type { IKeyStore } from './message-cache.types';
import { openMessageCacheDb, KEY_STORE } from './idb-schema';

export class WebKeyStore implements IKeyStore {
  private scope = '';

  async initialize(scope: string): Promise<void> {
    this.scope = scope;
    await this.openDb();
    await this.getOrCreateKey();
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
    return openMessageCacheDb();
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
