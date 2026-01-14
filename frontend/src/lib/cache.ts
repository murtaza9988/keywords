export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface TTLCache<T> {
  get: (key: string) => T | undefined;
  set: (key: string, value: T, ttlMs?: number) => void;
  invalidate: (key: string) => void;
  clear: () => void;
}

interface CreateTTLCacheOptions {
  defaultTtlMs: number;
  now?: () => number;
}

export function createTTLCache<T>({
  defaultTtlMs,
  now = () => Date.now(),
}: CreateTTLCacheOptions): TTLCache<T> {
  const store = new Map<string, CacheEntry<T>>();

  const isExpired = (entry: CacheEntry<T>) => entry.expiresAt <= now();

  return {
    get: (key: string) => {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (isExpired(entry)) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set: (key: string, value: T, ttlMs?: number) => {
      const expiresAt = now() + (ttlMs ?? defaultTtlMs);
      store.set(key, { value, expiresAt });
    },
    invalidate: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}
