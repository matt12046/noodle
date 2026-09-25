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

/** Saves data and returns the time it was saved. */
export function writeCache<T>(key: string, data: T): number {
  const savedAt = Date.now();
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt } satisfies Cached<T>));
  } catch {
    // Storage full or unavailable: the popup still works, it just refetches next time.
  }
  return savedAt;
}
