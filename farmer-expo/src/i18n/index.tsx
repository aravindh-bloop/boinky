import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
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

// ── module-level translation store ────────────────────────────────────────
//
// Every visible string flows through <Text>, which asks this store for a
// translation. Unknown strings are queued, batch-translated by the backend
// (Sarvam + a DB cache), merged in, and persisted to the device. So switching
// to Tamil translates the *whole* app, not just strings someone remembered to
// wrap — a screen briefly shows English on its first-ever visit, then swaps.

let lang: Lang = 'en';
let map: Record<string, string> = {};
const listeners = new Set<() => void>();
const pending = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;

const notify = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** Snapshot of the map — identity changes only when a translation lands. */
const getMapSnapshot = () => map;
const getLangSnapshot = () => lang;

const cacheKey = (l: Lang) => `agripod.i18n.${l}`;

/** A string worth translating: has letters, isn't a lone number/symbol/price. */
export function translatable(s: string): boolean {
  if (!s) return false;
  const t = s.trim();
  if (t.length < 2 || t.length > 400) return false;
  if (!/[A-Za-z]/.test(t)) return false; // digits, ₹, punctuation, already-Tamil
  return true;
}

/** Queue an unknown English string for background translation. */
export function requestTranslation(text: string): void {
  if (lang === 'en') return;
  const key = text.trim();
  if (!key || key in map || pending.has(key) || !translatable(key)) return;
  pending.add(key);
  if (!flushTimer) flushTimer = setTimeout(flush, 150);
}

async function flush(): Promise<void> {
  flushTimer = null;
  if (inFlight || pending.size === 0 || lang === 'en') return;
  const batch = [...pending].slice(0, 40);
  batch.forEach((b) => pending.delete(b));
  inFlight = true;
  const forLang = lang;
  try {
    const res = await api.request<{ map: Record<string, string>; pending?: string[] }>(
      '/api/i18n/translate',
      { method: 'POST', body: { lang: forLang, texts: batch }, timeoutMs: 90_000 },
    );
    if (forLang !== lang) return; // language changed mid-request
    // Only keep real translations. An entry equal to its English source means
    // the backend is still working on it — don't cache that, so it retries.
    let gained = false;
    for (const [en, tr] of Object.entries(res.map)) {
      if (tr && tr !== en) {
        map[en] = tr;
        gained = true;
      }
    }
    // still-pending strings from this batch go back in the queue for a retry
    for (const p of res.pending ?? []) if (!(p in map)) pending.add(p);
    if (gained) {
      map = { ...map };
      notify();
      AsyncStorage.setItem(cacheKey(lang), JSON.stringify(map)).catch(() => {});
    }
  } catch {
    // network/timeout — requeue this batch, retry shortly
    for (const b of batch) if (!(b in map)) pending.add(b);
  } finally {
    inFlight = false;
    // background translation on the server takes tens of seconds; give it time
    // before asking again, but keep going until everything is filled.
    if (pending.size > 0 && !flushTimer) flushTimer = setTimeout(flush, 4000);
  }
}

/** Called by the provider when the language changes. */
async function setLang(next: Lang): Promise<void> {
  if (next === lang) return;
  lang = next;
  pending.clear();
  if (next === 'en') {
    map = {};
    notify();
    return;
  }
  // paint from the device cache immediately …
  try {
    const raw = await AsyncStorage.getItem(cacheKey(next));
    map = raw ? JSON.parse(raw) : {};
  } catch {
    map = {};
  }
  notify();
  // … then make sure the core UI catalog is present/fresh
  const missing = CATALOG.filter((s) => !(s in map));
  if (missing.length) {
    missing.forEach((s) => pending.add(s));
    if (!flushTimer) flushTimer = setTimeout(flush, 0);
  }
}

// ── React surface ─────────────────────────────────────────────────────────

export type TFunc = (english: string, params?: Params) => string;

/** Module-level translate for non-React call sites (Alert.alert, helpers). */
export const tr: TFunc = (s, p) => {
  if (lang !== 'en') requestTranslation(s);
  return interpolate(lang === 'en' ? s : (map[s] ?? s), p);
};

interface I18nValue {
  lang: Lang;
  t: TFunc;
}

const Ctx = createContext<I18nValue>({ lang: 'en', t: (s, p) => interpolate(s, p) });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const target = normalizeLang(user?.preferred_language);

  useEffect(() => {
    void setLang(target);
  }, [target]);

  const activeLang = useSyncExternalStore(subscribe, getLangSnapshot, getLangSnapshot);
  const liveMap = useSyncExternalStore(subscribe, getMapSnapshot, getMapSnapshot);

  const value = useMemo<I18nValue>(() => {
    const t: TFunc = (english, params) => {
      if (activeLang !== 'en' && !(english in liveMap)) requestTranslation(english);
      return interpolate(activeLang === 'en' ? english : (liveMap[english] ?? english), params);
    };
    return { lang: activeLang, t };
  }, [activeLang, liveMap]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(Ctx);
}

/** `t('Diagnose crop')`, `t('Hello {name}', { name })`. */
export function useT(): TFunc {
  return useContext(Ctx).t;
}

/** Active language — for the Tamil font swap in <Text>. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLangSnapshot, getLangSnapshot);
}

/**
 * Auto-translate a single string for <Text>. Returns the English immediately,
 * swaps to the translation when it arrives. No-op in English.
 */
export function useAutoTranslate(text: string | null | undefined): string {
  const l = useSyncExternalStore(subscribe, getLangSnapshot, getLangSnapshot);
  const m = useSyncExternalStore(subscribe, getMapSnapshot, getMapSnapshot);
  useEffect(() => {
    if (l !== 'en' && text) requestTranslation(text);
  }, [l, text]);
  if (l === 'en' || !text) return text ?? '';
  return m[text] ?? text;
}
