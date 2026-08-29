import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Leaf } from 'lucide-react';
import { api, ApiError, getToken, setToken } from './api';

interface Officer {
  id: string;
  name: string;
  email: string | null;
  region: string | null;
  role: string;
}

interface AuthState {
  officer: Officer | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [officer, setOfficer] = useState<Officer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get<{ user: Officer }>('/api/auth/me')
      .then((r) => setOfficer(r.user.role === 'official' ? r.user : null))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (identifier: string, password: string) => {
    const r = await api.post<{ token: string; user: Officer }>(
      '/api/auth/login',
      { identifier, password },
      false,
    );
    if (r.user.role !== 'official') throw new ApiError(403, 'This account is not an officer account.');
    setToken(r.token);
    setOfficer(r.user);
  };

  const logout = () => {
    setToken(null);
    setOfficer(null);
  };

  return <Ctx.Provider value={{ officer, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

export function LoginGate({ children }: { children: ReactNode }) {
  const { officer, loading, login } = useAuth();
  const [identifier, setId] = useState('officer@agri.gov.in');
  const [password, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading)
    return <div className="min-h-screen grid place-items-center text-slate-400">Loading…</div>;
  if (officer) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await login(identifier.trim(), password);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-agri-primary/20 border border-agri-primary grid place-items-center">
            <Leaf size={20} className="text-agri-dark" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">AgriPod</h1>
            <p className="text-xs text-slate-500">Officer dashboard</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email or phone</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={identifier}
            onChange={(e) => setId(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input
            type="password"
            className="w-full border rounded-lg px-3 py-2"
            value={password}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 bg-agri-primary text-white font-medium rounded-lg hover:bg-agri-dark disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-xs text-slate-400 text-center">
          Demo: officer@agri.gov.in / secret123
        </p>
      </form>
    </div>
  );
}
