import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Minimal GET hook: fetch on mount + when `path` changes, plus manual reload. */
export function useApi<T>(path: string | null): State<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .get<T>(path)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : 'Something went wrong'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path, tick]);

  return { data, loading, error, reload };
}
