/**
 * Tiny in-memory response cache with stale-while-revalidate semantics.
 * Screens render the cached value instantly and refresh in the background.
 */
type Entry = { data: unknown; ts: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Map<string, Set<() => void>>();

export const cache = {
  get(key: string): Entry | undefined {
    return store.get(key);
  },
  set(key: string, data: unknown) {
    store.set(key, { data, ts: Date.now() });
    listeners.get(key)?.forEach((fn) => fn());
  },
  getInflight(key: string) {
    return inflight.get(key);
  },
  setInflight(key: string, p: Promise<unknown>) {
    inflight.set(key, p);
    p.finally(() => inflight.delete(key));
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
  clear() {
    store.clear();
  },
};
