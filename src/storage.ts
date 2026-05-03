import { openDB, type DBSchema } from 'idb';

export type Unit = 'kg' | 'lb';

export interface WeightEntry {
  id: string;
  value: number;
  unit: Unit;
  measuredAt: string;
  createdAt: string;
  updatedAt: string;
}

interface WeightTrackerDb extends DBSchema {
  entries: {
    key: string;
    value: WeightEntry;
    indexes: {
      'by-measured-at': string;
    };
  };
  settings: {
    key: string;
    value: {
      key: string;
      value: unknown;
    };
  };
}

const dbPromise = openDB<WeightTrackerDb>('weight-tracker', 1, {
  upgrade(db) {
    const entries = db.createObjectStore('entries', { keyPath: 'id' });
    entries.createIndex('by-measured-at', 'measuredAt');
    db.createObjectStore('settings', { keyPath: 'key' });
  },
});

export async function getEntries() {
  const db = await dbPromise;
  const entries = await db.getAllFromIndex('entries', 'by-measured-at');
  return entries.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
}

export async function saveEntry(entry: WeightEntry) {
  const db = await dbPromise;
  await db.put('entries', entry);
}

export async function deleteEntry(id: string) {
  const db = await dbPromise;
  await db.delete('entries', id);
}

export async function replaceEntries(entries: WeightEntry[]) {
  const db = await dbPromise;
  const tx = db.transaction('entries', 'readwrite');
  await tx.store.clear();
  await Promise.all(entries.map((entry) => tx.store.put(entry)));
  await tx.done;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = await dbPromise;
  const record = await db.get('settings', key);
  return record ? (record.value as T) : fallback;
}

export async function setSetting<T>(key: string, value: T) {
  const db = await dbPromise;
  await db.put('settings', { key, value });
}
