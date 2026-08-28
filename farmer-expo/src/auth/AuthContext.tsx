import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, loadToken, setToken } from '../api/client';
import { cache } from '../api/cache';
import type { AuthResponse, User } from '../api/types';

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
      if (token) {
        try {
          const res = await api.request<{ user: User }>('/api/auth/me');
          setUser(res.user);
        } catch {
          await setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      async signup(input) {
        const res = await api.request<AuthResponse>('/api/auth/signup', {
          method: 'POST',
          auth: false,
          body: { ...input, role: 'farmer' },
        });
        await setToken(res.token);
        setUser(res.user);
      },
      async login(identifier, password) {
        const res = await api.request<AuthResponse>('/api/auth/login', {
          method: 'POST',
          auth: false,
          body: { identifier, password },
        });
        await setToken(res.token);
        setUser(res.user);
      },
      async logout() {
        cache.clear();
        await setToken(null);
        setUser(null);
      },
      async refreshUser() {
        const res = await api.request<{ user: User }>('/api/auth/me');
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
