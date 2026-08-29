import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { CATALOG } from './catalog';

export type Lang = 'en' | 'ta';

/** Anything that isn't clearly Tamil is treated as English. */
export function normalizeLang(code: string | null | undefined): Lang {
  return code && code.toLowerCase().startsWith('ta') ? 'ta' : 'en';
}

type Params = Record<string, string | number>;

function interpolate(s: string, params?: Params): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

export type TFunc = (english: string, params?: Params) => string;

/**
 * Module-level translate, kept in sync with the active provider. For non-React
 * call sites — `Alert.alert`, imperative helpers. Prefer `useT()` in components.
 */
let liveT: TFunc = (s, p) => interpolate(s, p);
export const tr: TFunc = (s, p) => liveT(s, p);

interface I18nValue {
  lang: Lang;
  /** Translate an English UI string. Falls back to the English text itself. */
  t: TFunc;
  ready: boolean;
}

const Ctx = createContext<I18nValue>({ lang: 'en', t: (s, p) => interpolate(s, p), ready: true });

const cacheKey = (lang: Lang) => `agripod.i18n.${lang}`;

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const lang = normalizeLang(user?.preferred_language);
  const [map, setMap] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(lang === 'en');
  const loadedFor = useRef<Lang | null>(null);

  useEffect(() => {
    if (lang === 'en') {
      setMap({});
      setReady(true);
      loadedFor.current = 'en';
      return;
    }
    if (loadedFor.current === lang) return;
    loadedFor.current = lang;
    let cancelled = false;

    (async () => {
      // 1. paint immediately from the last cached bundle
      try {
        const raw = await AsyncStorage.getItem(cacheKey(lang));
        if (raw && !cancelled) {
          setMap(JSON.parse(raw));
          setReady(true);
        }
      } catch {
        /* ignore */
      }
      // 2. refresh the whole catalog in the background
      try {
        const res = await api.request<{ map: Record<string, string> }>('/api/i18n/translate', {
          method: 'POST',
          body: { lang, texts: CATALOG },
        });
        if (cancelled) return;
        setMap(res.map);
        setReady(true);
        AsyncStorage.setItem(cacheKey(lang), JSON.stringify(res.map)).catch(() => {});
      } catch {
        if (!cancelled) setReady(true); // fall back to English text
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lang]);

  const value = useMemo<I18nValue>(() => {
    const t: TFunc = (english, params) =>
      interpolate(lang === 'en' ? english : (map[english] ?? english), params);
    liveT = t;
    return { lang, t, ready };
  }, [lang, map, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(Ctx);
}

/** Translate function — the common case: `t('Diagnose crop')`, `t('Hello {name}', { name })`. */
export function useT(): TFunc {
  return useContext(Ctx).t;
}

/** Active language — for the Tamil font swap in <Text>. */
export function useLang(): Lang {
  return useContext(Ctx).lang;
}
