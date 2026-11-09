import { LEGACY_STORAGE_KEY, STORAGE_KEY, migrate, type Session } from './session';

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function memoryKV(): KV {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  };
}

export interface Store {
  /** False when the browser blocks storage and we fell back to memory (lost on refresh). */
  persistent: boolean;
  kv: KV;
  load(): { session: Session | null; message: string | null };
  save(s: Session): void;
  clear(): void;
}

function probe(kv: KV): boolean {
  try {
    const k = '__monitortest_probe__';
    kv.setItem(k, '1');
    const ok = kv.getItem(k) === '1';
    kv.removeItem(k);
    return ok;
  } catch {
    return false;
  }
}

export function createStore(preferred?: KV | null): Store {
  let kv: KV;
  let persistent = true;
  let candidate: KV | null = preferred ?? null;
  if (preferred === undefined) {
    try {
      candidate = typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
      candidate = null;
    }
  }
  if (candidate && probe(candidate)) kv = candidate;
  else {
    kv = memoryKV();
    persistent = false;
  }

  return {
    get persistent() {
      return persistent;
    },
    get kv() {
      return kv;
    },
    load() {
      let raw: string | null = null;
      let legacy = false;
      try {
        raw = kv.getItem(STORAGE_KEY);
        if (raw === null) {
          raw = kv.getItem(LEGACY_STORAGE_KEY);
          legacy = raw !== null;
        }
      } catch {
        return { session: null, message: null };
      }
      if (raw === null) return { session: null, message: null };
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = undefined;
      }
      const session = migrate(parsed);
      if (!session) {
        // Old-version data we cannot read is left alone (an older version may still use it).
        if (legacy) return { session: null, message: null };
        try {
          kv.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        return { session: null, message: 'Saved answers on this computer could not be read, so a fresh start was made.' };
      }
      return { session, message: null };
    },
    save(s) {
      try {
        kv.setItem(STORAGE_KEY, JSON.stringify(s));
      } catch {
        // Quota or a storage error: switch to memory so the app keeps working.
        if (persistent) {
          persistent = false;
          const mem = memoryKV();
          mem.setItem(STORAGE_KEY, JSON.stringify(s));
          kv = mem;
        }
      }
    },
    clear() {
      try {
        kv.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    },
  };
}
