import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { api, ApiError } from './client';
import { cache } from './cache';

interface State<T> {
  data: T | null;
  loading: boolean; // true only when there is no cached data yet
  error: string | null;
  refreshing: boolean; // background revalidation in progress
  reload: () => void;
}

/** How long a cached value is considered fresh (skip revalidation on focus). */
const FRESH_MS = 15_000;

/**
 * GET a path with stale-while-revalidate:
 *  - renders cached data immediately (no skeleton on repeat visits)
 *  - revalidates in the background on mount / focus (if stale)
 *  - dedupes concurrent requests for the same key
 */
export function useApi<T>(
  path: string | null,
  query?: Record<string, string | number | boolean | undefined>,
): State<T> {
  const key = path ? path + '?' + JSON.stringify(query ?? {}) : null;
  const cached = key ? (cache.get(key)?.data as T | undefined) : undefined;

  const [data, setData] = useState<T | null>(cached ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // re-sync when another hook instance updates the same key
  useEffect(() => {
    if (!key) return;
    return cache.subscribe(key, () => {
      const c = cache.get(key);
      if (c && mounted.current) setData(c.data as T);
    });
  }, [key]);

  const revalidate = useCallback(
    async (force: boolean) => {
      if (!path || !key) return;

      const existing = cache.get(key);
      if (!force && existing && Date.now() - existing.ts < FRESH_MS) {
        setData(existing.data as T);
        return;
      }

      let p = cache.getInflight(key) as Promise<T> | undefined;
      if (!p) {
        p = api.request<T>(path, { query });
        cache.setInflight(key, p);
      }

      if (mounted.current) setRefreshing(true);
      setError(null);
      try {
        const res = await p;
        cache.set(key, res);
        if (mounted.current) setData(res);
      } catch (e) {
        if (mounted.current) setError(e instanceof ApiError ? e.message : 'Something went wrong');
      } finally {
        if (mounted.current) setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  // initial + when key changes
  useEffect(() => {
    setData((cache.get(key ?? '')?.data as T) ?? null);
    revalidate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // on screen focus — only revalidate if stale
  useFocusEffect(
    useCallback(() => {
      revalidate(false);
    }, [revalidate]),
  );

  return {
    data,
    loading: data == null && !error,
    error,
    refreshing,
    reload: () => revalidate(true),
  };
}
