const DB_NAME    = 'EmployeeTracker';
const DB_VERSION = 1;
const STORE_NAME = 'events';

export class IndexedDbManager {
  private db: IDBDatabase | null = null;

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'eventId' });
        }
      };
      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onerror   = () => reject(req.error);
    });
  }

  async append(event: any): Promise<void> {
    if (!this.db) await this.open();
    return new Promise((resolve, reject) => {
      const tx    = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.put({ ...event, bufferedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async getOldest(limit = 100): Promise<any[]> {
    if (!this.db) await this.open();
    return new Promise((resolve, reject) => {
      const tx    = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.getAll();
      req.onsuccess = () => resolve((req.result ?? []).slice(0, limit));
      req.onerror   = () => reject(req.error);
    });
  }

  async deleteMany(eventIds: string[]): Promise<void> {
    if (!this.db) await this.open();
    return new Promise((resolve, reject) => {
      const tx    = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      let pending = eventIds.length;
      if (!pending) { resolve(); return; }
      eventIds.forEach(id => {
        const req = store.delete(id);
        req.onsuccess = () => { if (--pending === 0) resolve(); };
        req.onerror   = () => reject(req.error);
      });
    });
  }

  async count(): Promise<number> {
    if (!this.db) await this.open();
    return new Promise((resolve, reject) => {
      const tx    = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }
}
