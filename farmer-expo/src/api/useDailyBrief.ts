import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { api, ApiError } from './client';
import type { DailyBrief } from './types';

const POLL_MS = 4000;
/** ~2 min of polling. A brief takes ~5-20s; past this something is wrong. */
const MAX_POLLS = 30;
/** Don't re-fetch on every focus — the brief only changes when the farm does. */
const FRESH_MS = 60_000;

interface State {
  brief: DailyBrief | null;
  loading: boolean;
  error: string | null;
  /** The model is running right now (first generation, or a refresh of a stale brief). */
  working: boolean;
  refresh: () => void;
}

/**
 * The daily brief is produced in the background, so this polls until it settles
 * rather than blocking on one request — the same shape as waiting for a scan
 * advisory. Kept out of `useApi` because that hook has no notion of a pending
 * server-side job.
 */
export function useDailyBrief(): State {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const polls = useRef(0);
  const lastFetch = useRef(0);
  /** Set when the endpoint is absent — stops pointless retries for this session. */
  const disabled = useRef(false);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimer();
    };
  }, []);

  const load = useCallback(async (fresh: boolean) => {
    if (disabled.current) return;
    clearTimer();
    try {
      const res = await api.request<DailyBrief>('/api/insights/daily', {
        query: fresh ? { fresh: true } : undefined,
      });
      if (!mounted.current) return;
      lastFetch.current = Date.now();
      setBrief(res);
      setError(null);

      const pending = res.status === 'generating' || res.stale === true;
      setWorking(pending);

      if (pending && polls.current < MAX_POLLS) {
        polls.current += 1;
        timer.current = setTimeout(() => load(false), POLL_MS);
      } else {
        polls.current = 0;
        if (pending) setWorking(false); // gave up waiting; keep showing what we have
      }
    } catch (e) {
      if (!mounted.current) return;
      setWorking(false);
      setError(e instanceof ApiError ? e.message : 'Could not load your brief');
      // A backend without the insights route (not yet deployed) would otherwise
      // be re-asked on every screen focus, forever. Ask once and stop.
      if (e instanceof ApiError && e.status === 404) disabled.current = true;
    }
  }, []);

  const refresh = useCallback(() => {
    polls.current = 0;
    setWorking(true);
    void load(true);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastFetch.current > FRESH_MS) {
        polls.current = 0;
        void load(false);
      }
      return clearTimer;
    }, [load]),
  );

  return { brief, loading: brief == null && error == null, error, working, refresh };
}
