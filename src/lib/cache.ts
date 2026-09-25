// Popup-only cache in localStorage: reads are synchronous, so saved data renders
// before the first paint. Bump the version when the cached shapes change.
const PREFIX = 'noodle:v1:';

export interface Cached<T> {
  data: T;
  savedAt: number;
}

export function readCache<T>(key: string): Cached<T> | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Cached<T>) : undefined;
  } catch {
    return undefined;
  }
}

export function writeCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt: Date.now() } satisfies Cached<T>));
  } catch {
    // Storage full or unavailable: the popup still works, it just refetches next time.
  }
}

export function removeCache(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
