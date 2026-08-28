import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Response cache with stale-while-revalidate semantics, persisted to disk.
 *
 * Screens render the cached value instantly and refresh in the background. The
 * disk layer is what makes a *cold app start* fast: without it every launch
 * showed skeletons and waited on the network before painting anything real.
 */
type Entry = { data: unknown; ts: number };

const STORAGE_KEY = 'agripod.cache.v1';
/** Don't restore anything older than this — better a skeleton than a stale number. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Skip outsized responses so one big payload can't bloat every launch. */
const MAX_ENTRY_BYTES = 96 * 1024;
const MAX_ENTRIES = 40;
/** Coalesce bursts of writes into one serialize + one disk write. */
const FLUSH_DEBOUNCE_MS = 500;

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Map<string, Set<() => void>>();

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let hydrated = false;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_DEBOUNCE_MS);
}

async function flush() {
  try {
    // Newest first, so the cap keeps what the user is most likely to see next.
    const entries = [...store.entries()].sort((a, b) => b[1].ts - a[1].ts).slice(0, MAX_ENTRIES);
    const keep: [string, Entry][] = [];
    for (const [k, v] of entries) {
      const size = JSON.stringify(v.data)?.length ?? 0;
      if (size <= MAX_ENTRY_BYTES) keep.push([k, v]);
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(keep));
  } catch {
    // A cache that cannot persist is still a working in-memory cache.
  }
}

/**
 * Load the persisted cache. Cheap (one AsyncStorage read) and awaited during
 * startup while fonts load, so the first screen paints with real data.
 */
export async function hydrateCache(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw) as [string, Entry][];
    const cutoff = Date.now() - MAX_AGE_MS;
    for (const [k, v] of entries) {
      // Don't clobber anything a request already wrote while we were reading.
      if (v && typeof v.ts === 'number' && v.ts > cutoff && !store.has(k)) store.set(k, v);
    }
  } catch {
    // Corrupt or unreadable cache — start empty rather than fail the launch.
  }
}

export const cache = {
  get(key: string): Entry | undefined {
    return store.get(key);
  },
  set(key: string, data: unknown) {
    store.set(key, { data, ts: Date.now() });
    listeners.get(key)?.forEach((fn) => fn());
    scheduleFlush();
  },
  getInflight(key: string) {
    return inflight.get(key);
  },
  setInflight(key: string, p: Promise<unknown>) {
    inflight.set(key, p);
    // Deliberately not `p.finally(...)`: that returns a *new* promise which
    // rejects alongside `p` with nothing attached to it, so a failed request
    // surfaced as "Uncaught (in promise)" even though the caller handled the
    // error correctly. Passing both handlers to `then` settles the derived
    // promise instead.
    const done = () => inflight.delete(key);
    p.then(done, done);
  },
  subscribe(key: string, fn: () => void) {
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    set.add(fn);
    return () => {
      set!.delete(fn);
    };
  },
  /** Drop keys matching a prefix (e.g. after a mutation). */
  invalidate(prefix: string) {
    for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
  },
  /**
   * Force a refetch after a write. Memory only, and deliberately does not touch
   * disk: screens revalidate immediately and the fresh result rewrites the disk
   * copy. Erasing it here would mean every logged activity cost the next cold
   * start its instant paint.
   */
  clear() {
    store.clear();
  },
  /** Wipe memory *and* disk — logout, so nothing survives into another account. */
  purge() {
    store.clear();
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
};
