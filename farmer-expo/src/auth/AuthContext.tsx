import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, loadToken, setToken } from '../api/client';
import { cache } from '../api/cache';
import type { AuthResponse, User } from '../api/types';

const USER_KEY = 'agripod.user';

/** Remember the signed-in profile so a relaunch doesn't wait on the network. */
async function persistUser(user: User | null) {
  try {
    if (user) await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    else await AsyncStorage.removeItem(USER_KEY);
  } catch {
    // Non-fatal: we just lose the fast path on next launch.
  }
}

async function readPersistedUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

interface AuthState {
  user: User | null;
  loading: boolean;
  signup: (input: SignupInput) => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export interface SignupInput {
  name: string;
  password: string;
  phone?: string;
  email?: string;
  preferredLanguage?: string;
  region?: string;
}

const Ctx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await loadToken();
      if (!token) {
        setLoading(false);
        return;
      }

      // Show the last-known profile straight away and verify the token in the
      // background. `/api/auth/me` used to block the whole launch on a round
      // trip — on a cold Render instance that was the entire startup time.
      const cached = await readPersistedUser();
      if (cached) {
        setUser(cached);
        setLoading(false);
      }

      try {
        const res = await api.request<{ user: User }>('/api/auth/me');
        setUser(res.user);
        void persistUser(res.user);
      } catch (e) {
        // Only sign out on an actual rejection — a network blip must not log
        // the farmer out of an app that was working a second ago.
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          cache.purge();
          await setToken(null);
          await persistUser(null);
          setUser(null);
        }
        // Anything else (offline, timeout) leaves the cached profile in place if
        // we had one. With no cached profile there is nothing to show, so the
        // login screen is the honest fallback — never an endless spinner.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      async signup(input) {
        cache.purge();
        const res = await api.request<AuthResponse>('/api/auth/signup', {
          method: 'POST',
          auth: false,
          body: { ...input, role: 'farmer' },
        });
        await setToken(res.token);
        await persistUser(res.user);
        setUser(res.user);
      },
      async login(identifier, password) {
        cache.purge();
        const res = await api.request<AuthResponse>('/api/auth/login', {
          method: 'POST',
          auth: false,
          body: { identifier, password },
        });
        await setToken(res.token);
        await persistUser(res.user);
        setUser(res.user);
      },
      async logout() {
        cache.purge();
        await setToken(null);
        await persistUser(null);
        setUser(null);
      },
      async refreshUser() {
        const res = await api.request<{ user: User }>('/api/auth/me');
        await persistUser(res.user);
        setUser(res.user);
      },
    }),
    [user, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
